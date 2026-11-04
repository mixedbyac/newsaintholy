# newsaintholy.com

WHATUPRG · New Saint Holy Tour. Tour dates, fan **POV**, **Road** (behind the scenes), and the **Photobooth**.
Everything lives in **Dropbox**. The site only shows what's in it. Powered by ARTHOUSE.

---

## Dropbox is the storage

```
New Saint Holy/
├── Road/
│   ├── Houston/          ← anything in here (any subfolders) shows on Road
│   ├── Fort Worth/
│   └── San Antonio/
└── POV/
    ├── Uploaded/
    │   └── Houston/      ← fan uploads land here (private)
    └── Approved/
        └── Houston/      ← what POV shows
```

- Folder names never show on the site. Visitors only see the photos and videos.
- Show folders can be named by city or date: `Houston`, `11-19 Houston` and `11-19` all work.
- Approving a fan post moves it from **Uploaded** to **Approved**. You can also just drag it in Dropbox.
- Pass and Take down move files to `POV/Passed` or `Road/_Removed`. Nothing is ever deleted.
- iPhone HEIC photos work. Originals stay full quality in Dropbox.

## The corner dot = Team

The faint dot in the bottom-right corner opens the Team page.

| Role | Can do |
|---|---|
| **Owner** (you, made once) | Everything, plus disconnect Dropbox |
| **Admin** | Approve / pass POV, post to Road, take things down, invite and manage the team, Dropbox settings |
| **Contributor** (photographers, creators) | Post to Road |

- **Invite:** Team → enter an email → pick Admin or Contributor → **Invite** → send them the link. They pick a name and password.
- **Change role or remove:** right in the Team list. It takes effect immediately.

---

## Setup (one time)

### 1. Deploy on Vercel
1. vercel.com → **Add New → Project** → import `mixedbyac/newsaintholy`. Framework preset **Other**, no build command.
2. **Storage** tab → **Create / Connect** → **Upstash for Redis** (free) → connect it to this project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` on its own.
3. **Settings → Environment Variables** → add `SETUP_CODE` = any secret phrase you make up (you'll use it once).
4. **Redeploy** (Deployments → ⋯ → Redeploy).
5. **Settings → Domains** → add `newsaintholy.com` and `www.newsaintholy.com`.

> Vercel's free Hobby plan is for non-commercial use and has no team seats on the Vercel side (your site's own team accounts are separate and unlimited).
> Cloudflare Pages also works: build output directory `public`, add an Upstash database and the same env vars.

### 2. Make your owner account
Open `newsaintholy.com/#team` (or tap the corner dot) → enter the **setup code**, your name, email and password.

### 3. Connect Dropbox (from the Team page)
1. dropbox.com/developers/apps → **Create app** → Scoped access → **Full Dropbox** → name it.
2. **Permissions:** turn on `files.metadata.read`, `files.content.read`, `files.content.write` → Submit.
3. **Settings → OAuth 2 → Redirect URIs:** add `https://newsaintholy.com/api/dropbox-callback`
   (the Team page shows the exact address to copy).
4. On the Team page → **Dropbox** → paste the **App key** and **App secret** → Save → **Connect Dropbox** → sign in to the Dropbox that should own everything → Allow.
   The folders are created for you.

### 4. Check it
- Put a photo in `Road/Houston/`. It shows on Houston → Road within a minute.
- Upload on POV from your phone. It shows under **POV waiting** on the Team page → 👍 Approve. It goes live within a minute.

---

## Project layout

| Path | What it is |
|---|---|
| `public/index.html` | The whole site |
| `public/shows.js` | **Tour dates.** Edit to add shows (`folder` sets the Dropbox folder name) |
| `public/frames/` | Photobooth frames + the star |
| `functions/` | Server code (Cloudflare Pages Functions format) |
| `api/` | The same server code wired up for Vercel |
| `scripts/dropbox-connect.mjs` | Optional: connect Dropbox from the command line with env vars instead |

## Environment variables

| Name | Needed | What |
|---|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | yes | Upstash Redis (set by the Vercel integration). Stores team accounts and the Dropbox connection |
| `SETUP_CODE` | yes | One-time code to create the owner account |
| `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`, `DROPBOX_ROOT` | no | Only if you'd rather connect Dropbox with env vars than from the Team page |

## Ownership
Best practice: the artist owns the domain, Dropbox, GitHub, Vercel and Upstash accounts and adds the builder as a member.
