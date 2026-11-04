// Tiny key-value store on Upstash Redis (REST), so it runs the same on Vercel and Cloudflare.
// Env: KV_REST_API_URL + KV_REST_API_TOKEN (Vercel's Upstash integration sets these)
//   or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
import { HttpError } from "./_errors.js";

function conn(env) {
  const url = env.KV_REST_API_URL || env.STORAGE_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.STORAGE_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new HttpError(503, "The site's database isn't connected yet. Add Upstash Redis in your hosting settings.");
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
};

export const hasStore = (env) => !!((env.KV_REST_API_URL || env.STORAGE_REST_API_URL || env.UPSTASH_REDIS_REST_URL) && (env.KV_REST_API_TOKEN || env.STORAGE_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN));
