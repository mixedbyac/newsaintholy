// GET /api/media?section=road|pov[&show=houston]
// Road:  everything inside <root>/Road/<show folder>/**        (subfolders are fine, they stay invisible)
// POV:   everything inside <root>/POV/Approved/<show folder>/**
// Show folders can be named by city or date ("Houston", "11-19 Houston"). Visitors never see folder names.
import { SHOWS, MEDIA_RE, VIDEO_RE, root, json, fail, cached, showForFolder, listTree, dropboxCfg } from "../_lib.js";

export async function onRequestGet({ request, env, waitUntil }) {
  try {
    await dropboxCfg(env);
    const url = new URL(request.url);
    const section = url.searchParams.get("section") === "pov" ? "pov" : "road";
    const only = url.searchParams.get("show");
    return await cached(request, { waitUntil }, 60, async () => {
      const base = `${root(env)}/${section === "road" ? "Road" : "POV/Approved"}`;
      const items = [];
      for (const e of await listTree(env, base)) {
        if (e[".tag"] !== "file" || !MEDIA_RE.test(e.name)) continue;
        const parts = e.path_display.slice(base.length + 1).split("/");
        if (parts.length < 2 || parts[0].startsWith("_")) continue;          // must sit inside a show folder
        const show = showForFolder(parts[0]);
        if (!show || (only && show.id !== only)) continue;
        items.push({ path: e.path_display, rev: e.rev, show: show.id, type: VIDEO_RE.test(e.name) ? "video" : "image",
          time: Date.parse(e.client_modified || e.server_modified) || 0 });
      }
      items.sort((a, b) => section === "road" ? a.time - b.time : b.time - a.time);
      return json({ items });
    });
  } catch (e) {
    return fail(e);
  }
}
