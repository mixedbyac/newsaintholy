// Shared Dropbox helpers for the Pages Functions.
// Env vars (Cloudflare Pages → Settings → Environment variables):
//   DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN  (secrets)
//   DROPBOX_ROOT  e.g. "/New Saint Holy"  (optional, that is the default)
import { SHOWS, folderOf } from "../public/shows.js";
import { HttpError } from "./_errors.js";
import { kv, hasStore } from "./_store.js";
export { HttpError };

export { SHOWS, folderOf };
export const MEDIA_RE = /\.(jpe?g|png|gif|webp|heic|heif|tiff?|bmp|mp4|mov|m4v|webm)$/i;
export const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;


// Dropbox connection: saved from the admin page (Team → Dropbox) into the store.
// Env vars DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN / DROPBOX_ROOT still work as a fallback.
let cfgCache = { at: 0, cfg: null };
export async function dropboxCfg(env, fresh = false) {
  if (!fresh && cfgCache.cfg && Date.now() - cfgCache.at < 60000) return cfgCache.cfg;
  let saved = null;
  if (hasStore(env)) { try { saved = await kv.get(env, "cfg:dropbox"); } catch {} }
  const cfg = {
    appKey: saved?.appKey || env.DROPBOX_APP_KEY || "",
    appSecret: saved?.appSecret || env.DROPBOX_APP_SECRET || "",
    refreshToken: saved?.refreshToken || env.DROPBOX_REFRESH_TOKEN || "",
    root: (saved?.root || env.DROPBOX_ROOT || "/New Saint Holy").replace(/\/+$/, ""),
    account: saved?.account || "",
  };
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}
export const forgetCfg = () => { cfgCache = { at: 0, cfg: null }; tokenCache = { token: null, exp: 0 }; };

// Root folder. Kept sync for callers: uses the last loaded config (always loaded before any Dropbox call).
export const root = (env) => (cfgCache.cfg?.root || env.DROPBOX_ROOT || "/New Saint Holy").replace(/\/+$/, "");

let tokenCache = { token: null, exp: 0 };

async function accessToken(env, force = false) {
  if (!force && tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;
  const cfg = await dropboxCfg(env, force);
  if (!cfg.refreshToken || !cfg.appKey) throw new HttpError(503, "Dropbox isn't connected yet.");
  const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: cfg.refreshToken, client_id: cfg.appKey, client_secret: cfg.appSecret }),
  });
  if (!res.ok) throw new HttpError(502, "Dropbox sign-in failed. Reconnect Dropbox on the Team page.");
  const j = await res.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in - 300) * 1000 };
  return tokenCache.token;
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

// Only these folders are ever readable through the site:
//   <root>/Road/**            (except Road/_Removed)
//   <root>/POV/Approved/**
export function publicPath(env, p) {
  if (typeof p !== "string" || !p.startsWith("/") || p.includes("..") || p.includes("\\")) return false;
  const lp = p.toLowerCase(), r = root(env).toLowerCase();
  if (lp.startsWith(r + "/road/_removed/")) return false;
  return lp.startsWith(r + "/road/") || lp.startsWith(r + "/pov/approved/");
}

// Which show a folder belongs to. Name it however you like: "Houston", "11-19 Houston", "11-19", "2026-11-19".
export function showForFolder(name) {
  const n = String(name || "").toLowerCase();
  const byCity = SHOWS.find((s) => n.includes(folderOf(s).toLowerCase()) || n.includes(s.city.toLowerCase()));
  if (byCity) return byCity;
  return SHOWS.find((s) => {
    const [y, m, d] = s.date.split("-");
    return [s.date, `${m}-${d}`, `${+m}-${+d}`, `${m}.${d}`, `${+m}.${+d}`, `${m}${d}`].some((k) => new RegExp(`(^|[^0-9])${k.replace(".", "\\.")}([^0-9]|$)`).test(n));
  }) || null;
}

// List every file under a folder (recursive, all pages). Missing folder = empty.
export async function listTree(env, path) {
  let page;
  try { page = await rpc(env, "files/list_folder", { path, recursive: true, include_deleted: false, limit: 2000 }); }
  catch (e) { if (String(e.summary || "").includes("not_found")) return []; throw e; }
  const out = [...page.entries];
  while (page.has_more) { page = await rpc(env, "files/list_folder/continue", { cursor: page.cursor }); out.push(...page.entries); }
  return out;
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
