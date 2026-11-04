// Team accounts: owner (first account, set up once), admins, contributors.
// Passwords are PBKDF2-hashed (Web Crypto, works on Vercel Edge and Cloudflare). Sessions last 30 days.
import { kv } from "./_store.js";
import { HttpError } from "./_errors.js";

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomId = (bytes = 24) => hex(crypto.getRandomValues(new Uint8Array(bytes)));
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const ROLES = ["owner", "admin", "contributor"];

async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
  return hex(bits);
}
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function hashPassword(pw) {
  if (String(pw || "").length < 8) throw new HttpError(400, "Use at least 8 characters for the password.");
  const salt = randomId(16);
  return { salt, hash: await pbkdf2(pw, salt) };
}
export async function checkPassword(user, pw) {
  if (!user || !user.hash) return false;
  return same(await pbkdf2(String(pw || ""), user.salt), user.hash);
}

export const getUser = (env, email) => kv.get(env, "user:" + normEmail(email));
export async function saveUser(env, user) {
  user.email = normEmail(user.email);
  await kv.set(env, "user:" + user.email, user);
  await kv.sadd(env, "users", user.email);
  return user;
}
export async function deleteUser(env, email) {
  await kv.del(env, "user:" + normEmail(email));
  await kv.srem(env, "users", normEmail(email));
}
export async function listUsers(env) {
  const emails = await kv.smembers(env, "users");
  const users = await Promise.all(emails.map((e) => getUser(env, e)));
  return users.filter(Boolean).map(({ email, name, role, joined }) => ({ email, name, role, joined: !!joined }));
}
export const hasOwner = async (env) => !!(await kv.get(env, "owner"));

export async function newSession(env, email) {
  const token = randomId(32);
  await kv.set(env, "sess:" + token, { email: normEmail(email) }, 60 * 60 * 24 * 30);
  return token;
}
export const endSession = (env, token) => token && kv.del(env, "sess:" + token);

// Who is calling? Returns the user (with role) or null.
export async function currentUser(request, env) {
  const token = request.headers.get("x-team-token") || "";
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const s = await kv.get(env, "sess:" + token);
  if (!s) return null;
  const u = await getUser(env, s.email);
  return u && u.joined ? { ...u, token } : null;
}
export const isAdmin = (u) => u && (u.role === "owner" || u.role === "admin");
