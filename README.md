# ZipList — by EverBee

Design → Mockup → Printify → EverBee. Automated.

---

## Deploy in ~20 minutes

### What you're deploying

| File | What it is |
|------|-----------|
| `server.js` | API proxy server (Railway) |
| `ziplist.html` | The app itself (Cloudflare Pages or any static host) |

Users bring their own Printify and EverBee API keys. The server stores nothing.

---

## Step 1 — Deploy the proxy to Railway

1. **Create a GitHub repo** and push `server.js` and `package.json`

2. **Go to [railway.app](https://railway.app)** → New Project → Deploy from GitHub repo → select your repo

3. Railway auto-detects Node.js and runs `npm start`. Wait ~2 minutes.

4. Go to **Settings → Networking → Generate Domain**. You'll get a URL like:
   ```
   https://ziplist-proxy-production.up.railway.app
   ```
   Copy it — you'll need it in Step 3.

5. **Verify it works** — open `https://your-url.up.railway.app/health` in a browser. You should see:
   ```json
   { "ok": true, "service": "ZipList Proxy" }
   ```

---

## Step 2 — Host the app on Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com) → Create a project → **Upload assets**

2. Rename `ziplist.html` → `index.html`

3. Drag and drop `index.html` into the upload box → Deploy

4. Cloudflare gives you a URL like `https://ziplist.pages.dev`

> **Or** use any static host: Netlify (drag-drop), GitHub Pages, even just share the HTML file directly.

---

## Step 3 — Connect the app to your proxy

Open `index.html` and find this line near the top of the first `<script>`:

```js
const PROXY_BASE = window.ZIPLIST_PROXY || 'https://your-proxy.up.railway.app';
```

Replace `https://your-proxy.up.railway.app` with your actual Railway URL from Step 1.

Save and re-upload to Cloudflare Pages.

---

## That's it

Users visit your Cloudflare Pages URL, paste their own API keys in Settings, and everything works.

---

## Costs

| Service | Cost |
|---------|------|
| Railway (proxy) | ~$5/month (or free trial) |
| Cloudflare Pages (app) | Free |

---

## Local development

```bash
npm install
node server.js
```

Open `ziplist.html` directly in a browser. The app auto-falls back to `localhost:3456`.

---

## Custom domain

1. Buy a domain (e.g. `ziplist.io`)
2. In Cloudflare Pages → Custom Domains → add your domain
3. In Railway → Settings → Networking → Custom Domain → add `api.ziplist.io`
4. Update `PROXY_BASE` in `index.html` to `https://api.ziplist.io`
