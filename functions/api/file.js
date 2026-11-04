// GET /api/file?path=<dropbox path>
// Redirects to a short-lived Dropbox link for the original file (used for video playback).
import { publicPath, rpc, fail, HttpError, dropboxCfg } from "../_lib.js";

export async function onRequestGet({ request, env }) {
  try {
    await dropboxCfg(env);
    const path = new URL(request.url).searchParams.get("path");
    if (!publicPath(env, path)) throw new HttpError(404, "Not found");
    const { link } = await rpc(env, "files/get_temporary_link", { path });
    return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": "public, max-age=3000" } });
  } catch (e) {
    return fail(e);
  }
}
