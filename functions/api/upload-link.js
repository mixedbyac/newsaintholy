// POST /api/upload-link  {show, name, size, type}  →  {link}
// Gives the browser a one-time Dropbox upload link so the file goes phone → Dropbox directly
// (no server size limit on Vercel or Cloudflare; Dropbox allows up to 150 MB this way).
// Files land in <root>/POV/Uploaded/<City>/ and stay private until moved to <root>/POV/Approved/<City>/.
import { SHOWS, folderOf, MEDIA_RE, root, rpc, json, fail, HttpError, dropboxCfg } from "../_lib.js";

export const MAX_DIRECT = 150 * 1024 * 1024;
const clean = (n) => (n || "upload").replace(/[^\w.\- ]+/g, "").replace(/\s+/g, " ").trim().slice(-80) || "upload";

export async function onRequestPost({ request, env }) {
  try {
    await dropboxCfg(env);
    let b = {};
    try { b = await request.json(); } catch {}
    const show = SHOWS.find((s) => s.id === b.show);
    if (!show) throw new HttpError(400, "Pick a show first.");
    const name = clean(b.name);
    if (!MEDIA_RE.test(name) && !/^(image|video)\//.test(String(b.type || ""))) throw new HttpError(415, "Photos and videos only.");
    if (!(b.size > 0)) throw new HttpError(400, "Empty file.");
    if (b.size > MAX_DIRECT) throw new HttpError(413, "That file is over 150 MB. Trim the clip and try again.");
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const path = `${root(env)}/POV/Uploaded/${folderOf(show)}/${stamp} ${name}`;
    const { link } = await rpc(env, "files/get_temporary_upload_link", {
      commit_info: { path, mode: "add", autorename: true, mute: true }, duration: 3600,
    });
    return json({ link }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}
