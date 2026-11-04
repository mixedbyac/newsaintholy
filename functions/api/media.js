// GET /api/media?section=road|pov[&show=houston]
// Lists approved photos/videos from Dropbox: <root>/Road/<City>/** or <root>/POV/<City>/**.
// Subfolders inside a Road city folder come back as `album`.
import { SHOWS, folderOf, MEDIA_RE, VIDEO_RE, root, rpc, json, fail, cached } from "../_lib.js";

async function listAll(env, path) {
  const out = [];
  let page;
  try {
    page = await rpc(env, "files/list_folder", { path, recursive: true, include_deleted: false, limit: 2000 });
  } catch (e) {
    if (String(e.summary || "").includes("not_found")) return out; // folder not made yet = nothing posted
    throw e;
  }
  out.push(...page.entries);
  while (page.has_more) {
    page = await rpc(env, "files/list_folder/continue", { cursor: page.cursor });
    out.push(...page.entries);
  }
  return out;
}

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    const url = new URL(request.url);
    const section = url.searchParams.get("section") === "pov" ? "pov" : "road";
    const showId = url.searchParams.get("show");
    const shows = showId ? SHOWS.filter((s) => s.id === showId) : SHOWS;
    if (showId && !shows.length) return json({ items: [] });

    return await cached(request, { waitUntil }, 60, async () => {
      const base = `${root(env)}/${section === "road" ? "Road" : "POV"}`;
      const items = [];
      for (const s of shows) {
        const dir = `${base}/${folderOf(s)}`;
        const entries = await listAll(env, dir);
        for (const e of entries) {
          if (e[".tag"] !== "file" || !MEDIA_RE.test(e.name)) continue;
          const rel = e.path_display.slice(dir.length + 1);          // "Soundcheck/IMG_1.jpg"
          const parts = rel.split("/");
          if (section === "pov" && parts.length > 1 && /^inbox$/i.test(parts[0])) continue;
          items.push({
            path: e.path_display,
            name: e.name,
            rev: e.rev,
            show: s.id,
            album: parts.length > 1 ? parts.slice(0, -1).join(" / ") : "",
            type: VIDEO_RE.test(e.name) ? "video" : "image",
            time: Date.parse(e.client_modified || e.server_modified) || 0,
          });
        }
      }
      // Road: oldest first inside each album (tells the story of the day). POV: newest first.
      items.sort((a, b) => section === "road" ? (a.album.localeCompare(b.album) || a.time - b.time) : b.time - a.time);
      return json({ items });
    });
  } catch (e) {
    return fail(e);
  }
}
