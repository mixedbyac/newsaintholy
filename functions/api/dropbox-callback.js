// GET /api/dropbox-callback?code=…&state=…
// Dropbox sends the admin back here after they click Allow. Saves the connection and makes the folders.
import { SHOWS, folderOf, dropboxCfg, forgetCfg } from "../_lib.js";
import { kv } from "../_store.js";

const back = (origin, msg) => Response.redirect(`${origin}/#team${msg ? "-" + msg : ""}`, 302);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), origin = url.origin;
  try {
    const state = url.searchParams.get("state") || "", code = url.searchParams.get("code") || "";
    if (!code || !/^[0-9a-f]{32}$/.test(state) || !(await kv.get(env, "oauth:" + state))) return back(origin, "dropbox-failed");
    await kv.del(env, "oauth:" + state);
    const cfg = await dropboxCfg(env, true);
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: cfg.appKey, client_secret: cfg.appSecret, redirect_uri: origin + "/api/dropbox-callback" }),
    });
    const tok = await res.json().catch(() => ({}));
    if (!res.ok || !tok.refresh_token) return back(origin, "dropbox-failed");
    const auth = { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" };
    let account = "";
    try { const a = await (await fetch("https://api.dropboxapi.com/2/users/get_current_account", { method: "POST", headers: { Authorization: auth.Authorization } })).json(); account = a.name?.display_name ? `${a.name.display_name} (${a.email})` : a.email || ""; } catch {}
    const paths = [];
    for (const s of SHOWS) { const f = folderOf(s); paths.push(`${cfg.root}/Road/${f}`, `${cfg.root}/POV/Uploaded/${f}`, `${cfg.root}/POV/Approved/${f}`); }
    try { await fetch("https://api.dropboxapi.com/2/files/create_folder_batch", { method: "POST", headers: auth, body: JSON.stringify({ paths, autorename: false }) }); } catch {}
    const cur = (await kv.get(env, "cfg:dropbox")) || {};
    await kv.set(env, "cfg:dropbox", { ...cur, appKey: cfg.appKey, appSecret: cfg.appSecret, root: cfg.root, refreshToken: tok.refresh_token, account });
    forgetCfg();
    return back(origin, "dropbox-connected");
  } catch {
    return back(origin, "dropbox-failed");
  }
}
