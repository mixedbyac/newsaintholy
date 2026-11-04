// POST /api/team   header: X-Team-Token (after sign-in)   body: {action, ...}
// The team area behind the corner dot.
//   owner        the first account, made once with SETUP_CODE. Can do everything.
//   admin        approve/pass fan POV, post to Road, take things down, manage Dropbox and the team
//   contributor  photographers and creators: post to Road only
// Dropbox folders: POV/Uploaded (fan uploads) → Approve → POV/Approved. Nothing is deleted: Pass / Take down move files
// to POV/Passed or Road/_Removed.
import { SHOWS, folderOf, MEDIA_RE, VIDEO_RE, root, rpc, content, json, fail, HttpError, showForFolder, listTree, dropboxCfg, forgetCfg } from "../_lib.js";
import { kv } from "../_store.js";
import { hashPassword, checkPassword, getUser, saveUser, deleteUser, listUsers, hasOwner, newSession, endSession, currentUser, isAdmin, normEmail, randomId, ROLES } from "../_auth.js";

const clean = (n) => (n || "upload").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(-80) || "upload";
const okEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// Which show does a Dropbox path belong to, under a base folder ("POV/Uploaded", "POV/Approved", "Road")?
function locate(env, path, base) {
  const prefix = `${root(env)}/${base}/`;
  if (typeof path !== "string" || path.includes("..") || !path.toLowerCase().startsWith(prefix.toLowerCase())) return null;
  const rest = path.slice(prefix.length), i = rest.indexOf("/");
  if (i < 1 || rest.startsWith("_")) return null;
  const show = showForFolder(rest.slice(0, i));
  return show ? { show, folder: rest.slice(0, i), rel: rest.slice(i + 1) } : null;
}

async function listInbox(env) {
  const base = `${root(env)}/POV/Uploaded`, items = [];
  for (const e of await listTree(env, base)) {
    if (e[".tag"] !== "file" || !MEDIA_RE.test(e.name)) continue;
    const at = locate(env, e.path_display, "POV/Uploaded"); if (!at) continue;
    items.push({ path: e.path_display, rev: e.rev, show: at.show.id, type: VIDEO_RE.test(e.name) ? "video" : "image",
      time: Date.parse(e.client_modified || e.server_modified) || 0 });
  }
  return items.sort((a, b) => a.time - b.time);
}

async function move(env, from, to) {
  await rpc(env, "files/move_v2", { from_path: from, to_path: to, autorename: true, allow_ownership_transfer: false });
}

export async function onRequestPost({ request, env }) {
  try {
    let b = {}; try { b = await request.json(); } catch {}
    const origin = new URL(request.url).origin;

    // ---- no sign-in needed ----
    switch (b.action) {
      case "status": {
        const cfg = await dropboxCfg(env, true);
        return json({ setup: await hasOwner(env), dropbox: !!cfg.refreshToken });
      }
      case "setup": {
        if (await hasOwner(env)) throw new HttpError(409, "The owner account already exists. Sign in instead.");
        if (!env.SETUP_CODE || b.code !== env.SETUP_CODE) throw new HttpError(401, "That setup code didn't match.");
        const email = normEmail(b.email);
        if (!okEmail(email)) throw new HttpError(400, "Enter a real email.");
        const pw = await hashPassword(b.password);
        await saveUser(env, { email, name: String(b.name || "").slice(0, 60), role: "owner", joined: true, ...pw });
        await kv.set(env, "owner", email);
        return json({ token: await newSession(env, email), role: "owner" });
      }
      case "login": {
        const u = await getUser(env, b.email);
        if (!u || !u.joined || !(await checkPassword(u, b.password))) throw new HttpError(401, "Email or password didn't match.");
        return json({ token: await newSession(env, u.email), role: u.role, name: u.name });
      }
      case "invite-info": {
        const inv = await kv.get(env, "invite:" + String(b.code || ""));
        if (!inv) throw new HttpError(404, "This invite link expired or was already used.");
        return json({ email: inv.email, role: inv.role });
      }
      case "join": {
        const code = String(b.code || ""), inv = await kv.get(env, "invite:" + code);
        if (!inv) throw new HttpError(404, "This invite link expired or was already used.");
        const pw = await hashPassword(b.password);
        const u = (await getUser(env, inv.email)) || { email: inv.email, role: inv.role };
        await saveUser(env, { ...u, name: String(b.name || u.name || "").slice(0, 60), joined: true, ...pw });
        await kv.del(env, "invite:" + code);
        return json({ token: await newSession(env, inv.email), role: u.role });
      }
    }

    // ---- signed in ----
    const me = await currentUser(request, env);
    if (!me) throw new HttpError(401, "Please sign in.");
    const admin = isAdmin(me);
    await dropboxCfg(env);
    const R = root(env);

    switch (b.action) {
      case "me":
        return json({ email: me.email, name: me.name, role: me.role });
      case "logout":
        await endSession(env, me.token);
        return json({ ok: true });

      // -- Dropbox settings --
      case "dropbox-status": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const cfg = await dropboxCfg(env, true);
        return json({ connected: !!cfg.refreshToken, account: cfg.account, root: cfg.root, hasApp: !!(cfg.appKey && cfg.appSecret),
          appKey: cfg.appKey, redirectUri: origin + "/api/dropbox-callback" });
      }
      case "dropbox-app": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const cur = (await kv.get(env, "cfg:dropbox")) || {};
        const appKey = String(b.appKey || cur.appKey || "").trim(), appSecret = String(b.appSecret || cur.appSecret || "").trim();
        if (!appKey || !appSecret) throw new HttpError(400, "Paste both the App key and App secret.");
        let rootDir = String(b.root || cur.root || "/New Saint Holy").trim(); if (!rootDir.startsWith("/")) rootDir = "/" + rootDir;
        await kv.set(env, "cfg:dropbox", { ...cur, appKey, appSecret, root: rootDir.replace(/\/+$/, "") });
        forgetCfg();
        return json({ ok: true });
      }
      case "dropbox-connect": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const cfg = await dropboxCfg(env, true);
        if (!cfg.appKey) throw new HttpError(400, "Save the App key and secret first.");
        const state = randomId(16);
        await kv.set(env, "oauth:" + state, { email: me.email }, 600);
        const q = new URLSearchParams({ client_id: cfg.appKey, response_type: "code", token_access_type: "offline", state, redirect_uri: origin + "/api/dropbox-callback" });
        return json({ url: "https://www.dropbox.com/oauth2/authorize?" + q });
      }
      case "dropbox-disconnect": {
        if (me.role !== "owner") throw new HttpError(403, "Only the owner can disconnect Dropbox.");
        const cur = (await kv.get(env, "cfg:dropbox")) || {};
        delete cur.refreshToken; delete cur.account;
        await kv.set(env, "cfg:dropbox", cur); forgetCfg();
        return json({ ok: true });
      }

      // -- Team members --
      case "members":
        if (!admin) throw new HttpError(403, "Admins only.");
        return json({ members: await listUsers(env) }, { headers: { "Cache-Control": "no-store" } });
      case "invite": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const email = normEmail(b.email), role = b.role === "admin" ? "admin" : "contributor";
        if (!okEmail(email)) throw new HttpError(400, "Enter a real email.");
        const existing = await getUser(env, email);
        if (existing && existing.role === "owner") throw new HttpError(400, "That's the owner.");
        await saveUser(env, { ...(existing || {}), email, role, joined: !!existing?.joined, name: existing?.name || "" });
        const code = randomId(18);
        await kv.set(env, "invite:" + code, { email, role }, 60 * 60 * 24 * 14);
        return json({ link: `${origin}/#join-${code}` });
      }
      case "set-role": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const u = await getUser(env, b.email);
        if (!u) throw new HttpError(404, "No one with that email.");
        if (u.role === "owner") throw new HttpError(400, "The owner stays the owner.");
        if (!ROLES.includes(b.role) || b.role === "owner") throw new HttpError(400, "Pick Admin or Contributor.");
        await saveUser(env, { ...u, role: b.role });
        return json({ ok: true });
      }
      case "remove-member": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const u = await getUser(env, b.email);
        if (!u) return json({ ok: true });
        if (u.role === "owner") throw new HttpError(400, "The owner can't be removed.");
        await deleteUser(env, u.email);
        return json({ ok: true });
      }

      case "inbox":
        if (!admin) throw new HttpError(403, "Admins only.");
        return json({ items: await listInbox(env) }, { headers: { "Cache-Control": "no-store" } });

      case "approve": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const at = locate(env, b.path, "POV/Uploaded"); if (!at) throw new HttpError(400, "Not an uploaded file.");
        await move(env, b.path, `${R}/POV/Approved/${at.folder}/${at.rel}`);
        return json({ ok: true });
      }
      case "pass": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const at = locate(env, b.path, "POV/Uploaded"); if (!at) throw new HttpError(400, "Not an uploaded file.");
        await move(env, b.path, `${R}/POV/Passed/${at.folder}/${at.rel}`);
        return json({ ok: true });
      }
      case "takedown": {
        if (!admin) throw new HttpError(403, "Admins only.");
        const road = locate(env, b.path, "Road"), pov = !road && locate(env, b.path, "POV/Approved");
        if (road) await move(env, b.path, `${R}/Road/_Removed/${road.folder}/${road.rel}`);
        else if (pov) await move(env, b.path, `${R}/POV/Passed/${pov.folder}/${pov.rel}`);
        else throw new HttpError(400, "Not a live file.");
        return json({ ok: true });
      }
      case "road-upload-link": {
        if (!admin && me.role !== "contributor") throw new HttpError(403, "No access.");
        const show = SHOWS.find((s) => s.id === b.show); if (!show) throw new HttpError(400, "Pick a show.");
        const name = clean(b.name);
        if (!MEDIA_RE.test(name)) throw new HttpError(415, "Photos and videos only.");
        if (!(b.size > 0) || b.size > 150 * 1024 * 1024) throw new HttpError(413, "Files up to 150 MB.");
        const path = `${R}/Road/${folderOf(show)}/${name}`;
        const { link } = await rpc(env, "files/get_temporary_upload_link", { commit_info: { path, mode: "add", autorename: true, mute: true }, duration: 3600 });
        return json({ link });
      }
      case "thumb": {
        if (!admin) throw new HttpError(403, "Admins only.");
        if (!locate(env, b.path, "POV/Uploaded")) throw new HttpError(400, "Not an uploaded file.");
        if (VIDEO_RE.test(b.path)) { const { link } = await rpc(env, "files/get_temporary_link", { path: b.path }); return json({ link }); }
        const res = await content(env, "files/get_thumbnail_v2", { resource: { ".tag": "path", path: b.path }, format: "jpeg", size: "w640h480", mode: "fitone_bestfit" });
        if (!res.ok) throw new HttpError(404, "No preview.");
        return new Response(res.body, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=600" } });
      }
      default:
        throw new HttpError(400, "Unknown action.");
    }
  } catch (e) {
    return fail(e);
  }
}
