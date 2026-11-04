// Vercel adapter: same handler as functions/api/upload-link.js (Cloudflare Pages).
import { onRequestPost } from "../functions/api/upload-link.js";
export const config = { runtime: "edge" };
export default (request) => onRequestPost({ request, env: process.env, waitUntil: () => {} });
