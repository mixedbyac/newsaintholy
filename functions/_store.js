// Tiny key-value store on Upstash Redis (REST), so it runs the same on Vercel and Cloudflare.
// Env: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel's Upstash integration sets these)
//   or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
import { HttpError } from "./_errors.js";

// Finds the Upstash REST settings whatever prefix the hosting integration used (KV_, STORAGE_, UPSTASH_REDIS_, custom…).
function find(env) {
  const keys = Object.keys(env || {});
  const pick = (re, bad) => keys.find((k) => re.test(k) && !(bad && bad.test(k)) && env[k]);
  const urlKey = ["KV_REST_API_URL", "STORAGE_REST_API_URL", "UPSTASH_REDIS_REST_URL"].find((k) => env[k]) || pick(/_REST_(API_)?URL$/);
  const tokKey = ["KV_REST_API_TOKEN", "STORAGE_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"].find((k) => env[k]) || pick(/_REST_(API_)?TOKEN$/, /READ_ONLY/);
  return { url: urlKey && env[urlKey], token: tokKey && env[tokKey], urlKey, tokKey };
}

function conn(env) {
  const { url, token } = find(env);
  if (!url || !token) {
    const seen = Object.keys(env || {}).filter((k) => /KV|REDIS|UPSTASH|STORAGE/i.test(k));
    throw new HttpError(503, "The site's database isn't connected yet. Connect Upstash Redis to this project in Vercel → Storage, then redeploy."
      + (seen.length ? ` (Found: ${seen.join(", ")})` : " (No database settings found in this deployment.)"));
  }
  return { url: url.replace(/\/+$/, ""), token };
}

export async function redis(env, ...cmd) {
  const { url, token } = conn(env);
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new HttpError(502, "Database error.");
  return j.result;
}

export const kv = {
  async get(env, key) { const v = await redis(env, "GET", key); return v == null ? null : JSON.parse(v); },
  async set(env, key, val, ttlSec) { return ttlSec ? redis(env, "SET", key, JSON.stringify(val), "EX", String(ttlSec)) : redis(env, "SET", key, JSON.stringify(val)); },
  async del(env, key) { return redis(env, "DEL", key); },
  async sadd(env, key, m) { return redis(env, "SADD", key, m); },
  async srem(env, key, m) { return redis(env, "SREM", key, m); },
  async smembers(env, key) { return (await redis(env, "SMEMBERS", key)) || []; },
  async lpush(env, key, val) { return redis(env, "LPUSH", key, JSON.stringify(val)); },
  async ltrim(env, key, a, b) { return redis(env, "LTRIM", key, String(a), String(b)); },
  async lrange(env, key, a, b) { return ((await redis(env, "LRANGE", key, String(a), String(b))) || []).map((v) => JSON.parse(v)); },
};

export const hasStore = (env) => { const f = find(env); return !!(f.url && f.token); };

// Activity log: newest first, keeps the last 1000 entries. Never throws (logging must not break an action).
export async function logEvent(env, who, what) {
  try {
    if (!hasStore(env)) return;
    await kv.lpush(env, "log", { at: Date.now(), who: who || "Someone", what });
    await kv.ltrim(env, "log", 0, 999);
  } catch {}
}
