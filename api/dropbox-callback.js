// Vercel adapter: same handler as functions/api/dropbox-callback.js (Cloudflare Pages).
import { onRequestGet } from "../functions/api/dropbox-callback.js";
export const config = { runtime: "edge" };
export default (request) => onRequestGet({ request, env: process.env, waitUntil: () => {} });
