// Vercel adapter: same handler as functions/api/media.js (Cloudflare Pages).
import { onRequestGet } from "../functions/api/media.js";
export const config = { runtime: "edge" };
export default (request) => onRequestGet({ request, env: process.env, waitUntil: () => {} });
