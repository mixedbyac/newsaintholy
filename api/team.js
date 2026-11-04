// Vercel adapter: same handler as functions/api/team.js (Cloudflare Pages).
import { onRequestPost } from "../functions/api/team.js";
export const config = { runtime: "edge" };
export default (request) => onRequestPost({ request, env: process.env, waitUntil: () => {} });
