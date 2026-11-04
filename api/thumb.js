// Vercel adapter: same handler as functions/api/thumb.js (Cloudflare Pages).
import { onRequestGet } from "../functions/api/thumb.js";
export const config = { runtime: "edge" };
export default (request) => onRequestGet({ request, env: process.env, waitUntil: () => {} });
