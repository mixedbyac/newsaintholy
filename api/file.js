// Vercel adapter: same handler as functions/api/file.js (Cloudflare Pages).
import { onRequestGet } from "../functions/api/file.js";
export const config = { runtime: "edge" };
export default (request) => onRequestGet({ request, env: process.env, waitUntil: () => {} });
