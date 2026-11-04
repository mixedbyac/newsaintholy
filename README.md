# newsaintholy.com

WHATUPRG · New Saint Holy Tour. Tour dates, fan **POV**, **Road** (behind the scenes), and the **Photobooth**.
Everything lives in **Dropbox**. The site only shows what's in it.

Powered by ARTHOUSE.

---

## How it works

```
New Saint Holy/                ← main folder in Dropbox
├── Road/
│   ├── Houston/               → Road on the Houston page
│   │   ├── Soundcheck/        → each subfolder shows as its own section
│   │   └── Load In/
│   ├── Fort Worth/
│   └── San Antonio/
└── POV/
    ├── Inbox/
    │   └── Houston/           ← fan uploads land here (private)
    └── Houston/               ← drag a file here to approve it → live on POV
```

- **Add photos or videos to a Road folder** and they show on the site within about a minute.
- **Delete or move a file out** and it disappears from the site.
- **Fans upload on the site.** Files go straight from their phone into `POV/Inbox/<City>`, up to 150 MB each.
  Nothing in Inbox is ever shown publicly.
- **To approve a fan post,** move it from `POV/Inbox/<City>` to `POV/<City>`.
- **Photographers and creators:** share the `Road` folder with them in Dropbox (Share → invite as *Can edit*),
  or send them a Dropbox **File request** link pointing at a Road city folder (no Dropbox account needed).
- **Admins:** anyone who can edit the `New Saint Holy` folder in Dropbox. Approving and removing all happens in Dropbox.
- iPhone HEIC photos work. The site shows web-sized previews, and the originals stay full quality in Dropbox.

## Project layout

| Path | What it is |
|---|---|
| `public/index.html` | The whole site (tour, POV, Road, Photobooth, Terms) |
| `public/shows.js` | **Tour dates.** Edit here to add or change shows. `folder` overrides the Dropbox folder name. |
| `public/frames/` | Photobooth frames (`<city>-3up-tall.png`, `<city>-3up-square.png`, `<city>-tall.png`) and the star |
| `functions/api/*` | Dropbox reader + upload links (Cloudflare Pages Functions) |
| `api/*` | The same handlers wired up for Vercel |
| `scripts/dropbox-connect.mjs` | One-time Dropbox connect + folder setup |

---

## Setup (one time)

### 1. Dropbox app
1. Go to **dropbox.com/developers/apps** → **Create app**.
2. Choose **Scoped access** → **Full Dropbox** → name it e.g. `newsaintholy-site`.
3. **Permissions** tab → turn on `files.metadata.read`, `files.content.read`, `files.content.write` → **Submit**.
4. **Settings** tab → copy the **App key** and **App secret**.
5. On your computer, in this project folder, run:
   ```
   npm run dropbox:connect
   ```
   Paste the key and secret, open the link it prints, **sign in to the Dropbox that should own everything**, click Allow,
   paste the code back. It creates the folders and prints four environment variables.

### 2a. Deploy on Vercel
1. Push this folder to GitHub (repo `newsaintholy`).
2. vercel.com → **Add New → Project** → import the repo. Framework preset: **Other**. No build command.
3. **Settings → Environment Variables:** add the four `DROPBOX_…` values from step 1.
4. **Settings → Domains:** add `newsaintholy.com` and `www.newsaintholy.com`, then follow the DNS instructions.
5. Note: Vercel's free Hobby plan is for non-commercial use and has no team seats. Pro is about $20 a month per member.

### 2b. Or deploy on Cloudflare Pages
1. dash.cloudflare.com → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build command: *(empty)* · Build output directory: `public`.
3. **Settings → Environment variables:** add the four `DROPBOX_…` values (mark them as secrets).
4. **Custom domains:** add `newsaintholy.com`.
5. Free for commercial use, team members are free, and photos are cached at the edge.

### 3. Check it
- Put a photo in `Road/Houston/` → open `newsaintholy.com/#show-houston` → **Road**. It shows within about a minute.
- Upload from **POV** on your phone → it lands in `POV/Inbox/Houston/` → move it to `POV/Houston/` → it's live.

---

## Everyday changes

- **New show:** add a line to `public/shows.js`, then add frames for it in `public/frames/` if you want custom photobooth frames
  (the `FRAMES` list in `index.html` maps shows to frame files). Re-run `npm run dropbox:connect` or just make the folders by hand.
- **Rename a city folder:** set `folder: "Exact Dropbox Name"` on that show in `shows.js`.
- **Past tours:** saved in `index.html` under `ARCHIVE_ALL` and hidden. Set `SHOW_ARCHIVE = true` to bring back the year picker.

## Ownership

Best practice: the artist (or their company) owns the **domain, Dropbox, GitHub and hosting accounts**, and adds the builder as a member.
Nothing is stored anywhere except their Dropbox.
