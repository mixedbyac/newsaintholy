// Shared Dropbox helpers for the Pages Functions.
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN  (secrets)
//   DROPBOX_ROOT  e.g. "/New Saint Holy"  (optional, that is the default)
import { SHOWS, folderOf } from "../public/shows.js";

export { SHOWS, folderOf };
export const MEDIA_RE = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|mp4|mov|m4v|webm)$/i;
export const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;


export const root = (env) => (env.DROPBOX_ROOT || "/New Saint Holy").replace(/\/+$/, "");

let tokenCache = { token: null, exp: 0 };

async function accessToken(env, force = false) {
  if (!force && tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: env.DROPBOX_REFRESH_TOKEN,
      client_id: env.DROPBOX_APP_KEY,
      client_secret: env.DROPBOX_APP_SECRET,
    }),
  });
  if (!res.ok) throw new HttpError(502, "Dropbox sign-in failed. Check the Dropbox env vars.");
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 300) * 1000 };
  return tokenCache.token;
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Dropbox-API-Arg must be ASCII: escape everything else as \uXXXX.
const headerJson = (o) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

async function call(env, url, init, retried = false) {
  const token = await accessToken(env, retried);
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  if (res.status === 401 && !retried) return call(env, url, init, true);
  return res;
}

// RPC endpoint (JSON in, JSON out)
export async function rpc(env, endpoint, body) {
  const res = await call(env, `https://api.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { error_summary: text }; }
  if (!res.ok) { const e = new HttpError(res.status === 409 ? 409 : 502, data.error_summary || "Dropbox error"); e.summary = data.error_summary || ""; throw e; }
  return data;
}

// Content endpoint (arg in header, raw body / raw response)
export async function content(env, endpoint, arg, body) {
  return call(env, `https://content.dropboxapi.com/2/${endpoint}`, {
    method: "POST",
    headers: { "Dropbox-API-Arg": headerJson(arg), ...(body ? { "Content-Type": "application/octet-stream" } : {}) },
    body: body || undefined,
  });
}

// Only approved, public folders may be read through the site: Road/** and POV/** except POV/Inbox/**.
export function publicPath(env, p) {
  if (typeof p !== "string" || !p.startsWith("/") || p.includes("..") || p.includes("\\")) return false;
  const lp = p.toLowerCase(), r = root(env).toLowerCase();
  if (lp.startsWith(r + "/road/")) return true;
  if (lp.startsWith(r + "/pov/") && !lp.startsWith(r + "/pov/inbox/")) return true;
  return false;
}

export const json = (data, init = {}) =>
  new Response(JSON.stringify(data), { ...init, headers: { "Content-Type": "application/json; charset=utf-8", ...(init.headers || {}) } });

export function fail(e) {
  const status = e instanceof HttpError ? e.status : 500;
  return json({ error: e.message || "Something went wrong" }, { status, headers: { "Cache-Control": "no-store" } });
}

// Edge cache wrapper (Cloudflare Cache API). Falls through when caches.default is missing (local tests).
export async function cached(request, ctx, ttl, make) {
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(new URL(request.url).toString(), { method: "GET" });
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const made = await make();
  const res = new Response(made.body, made); // fetch() responses have read-only headers
  if (res.ok) {
    res.headers.set("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
    if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, res.clone()));
  }
  return res;
}
