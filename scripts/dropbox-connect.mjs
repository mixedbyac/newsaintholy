// One-time setup: connects the site to a Dropbox account and makes the folders.
// Run:  npm run dropbox:connect     (needs Node 18+)
// It prints DROPBOX_REFRESH_TOKEN — paste that into Vercel or Cloudflare as an environment variable.
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { SHOWS, folderOf } from "../public/shows.js";

const rl = readline.createInterface({ input, output });
const key = (await rl.question("Dropbox App key: ")).trim();
const secret = (await rl.question("Dropbox App secret: ")).trim();
const root = ((await rl.question('Main folder in Dropbox [/New Saint Holy]: ')).trim() || "/New Saint Holy").replace(/\/+$/, "");

console.log("\n1) Open this link, sign in to the Dropbox that should hold everything, and click Allow:\n");
console.log(`https://www.dropbox.com/oauth2/authorize?client_id=${encodeURIComponent(key)}&response_type=code&token_access_type=offline\n`);
const code = (await rl.question("2) Paste the code Dropbox shows you: ")).trim();
rl.close();

const tokRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: key, client_secret: secret }),
});
const tok = await tokRes.json();
if (!tokRes.ok || !tok.refresh_token) { console.error("\nDropbox said no:", tok.error_description || tok.error || tok); process.exit(1); }

// Make the folder structure (safe to run again; existing folders are left alone).
const paths = [];
for (const s of SHOWS) {
  const f = folderOf(s);
  paths.push(`${root}/Road/${f}`, `${root}/POV/Uploaded/${f}`, `${root}/POV/Approved/${f}`);
}
const mk = await fetch("https://api.dropboxapi.com/2/files/create_folder_batch", {
  method: "POST",
  headers: { Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ paths, autorename: false, force_async: false }),
});
console.log(mk.ok ? `\nFolders ready in Dropbox under ${root}` : "\n(Couldn't create folders automatically. Make them by hand; see README.)");

console.log("\n3) Add these environment variables in Vercel or Cloudflare:\n");
console.log(`DROPBOX_APP_KEY=${key}`);
console.log(`DROPBOX_APP_SECRET=${secret}`);
console.log(`DROPBOX_REFRESH_TOKEN=${tok.refresh_token}`);
console.log(`DROPBOX_ROOT=${root}\n`);
