// GET /api/thumb?path=<dropbox path>&size=m|l&rev=<rev>
// JPEG preview made by Dropbox (also turns iPhone HEIC into something browsers can show). Cached at the edge.
import { publicPath, content, fail, cached, HttpError, dropboxCfg } from "../_lib.js";

const SIZES = { s: "w256h256", m: "w640h480", l: "w2048h1536" };

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    await dropboxCfg(env);
    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    if (!publicPath(env, path)) throw new HttpError(404, "Not found");
    const size = SIZES[url.searchParams.get("size")] || SIZES.m;
    return await cached(request, { waitUntil }, 60 * 60 * 24 * 7, async () => {
      const res = await content(env, "files/get_thumbnail_v2", {
        resource: { ".tag": "path", path }, format: "jpeg", size, mode: "fitone_bestfit",
      });
      if (!res.ok) throw new HttpError(res.status === 409 ? 404 : 502, "Preview not available");
      return new Response(res.body, { headers: { "Content-Type": "image/jpeg" } });
    });
  } catch (e) {
    return fail(e);
  }
}
