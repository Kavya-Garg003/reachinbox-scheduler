# SETUP GUIDE: from zero to submitted

Written for Windows 10/11 (Mac/Linux notes where commands differ). Do the steps **in order**.

---

## 0. Read this first

**Deadline: 1 October 2026, 1:00 PM.** Check your clock now. Realistic time needed: **2.5 to 3 hours** if nothing goes wrong.

| Block | Time |
|---|---|
| Install tools (Section 2) | 30 to 45 min (Docker is the slow one) |
| Start services + run locally (Sections 3 to 5) | 20 min |
| Google login setup (Section 6) | 15 min |
| Public URL with ngrok (Section 7) | 10 min |
| Slack setup (Section 8) | 15 min |
| GitHub (Section 10) | 10 min |
| Demo video (Sections 9 and 11) | 25 min |
| Submission form (Section 12) | 10 min |

**If you're short on time, priorities:**
1. Get the app running locally and scheduling/sending emails (Sections 2 to 5).
2. GitHub repo with README and both reviewers invited.
3. Demo video showing schedule, sent, restart.
4. Google login + public URL.
5. Slack (it is a required item, so don't skip it unless you truly run out of time; if you do, say so in the README rather than hiding it).

Submissions after the deadline may not be considered, so **submit something working on time rather than something perfect late.**

**Important facts I verified (don't waste time on these):**
- **Do NOT host the backend on Render's free tier.** It blocks outbound SMTP ports 25, 465, 587, and Ethereal needs one of them, so emails would never send.
- Free Render services also sleep after 15 minutes idle, which stops the scheduler.
- The hosted link we'll use is **your laptop + ngrok** (Section 7). The laptop must stay on and awake while evaluators might test.

---

## 1. What you will install / create

### Software
| Tool | What for | Where |
|---|---|---|
| **Git** | push code to GitHub | https://git-scm.com/download/win |
| **Node.js 22 LTS** | runs backend + builds frontend | https://nodejs.org (download the LTS installer) |
| **Docker Desktop** | runs Redis, MySQL, Elasticsearch | https://www.docker.com/products/docker-desktop/ |
| **VS Code** (optional) | edit files / terminal | https://code.visualstudio.com |
| **ngrok** | public HTTPS link to your laptop | https://ngrok.com/download |
| **Screen recorder** | demo video | Loom (free) or Windows Game Bar (`Win + G`) or OBS |

### Accounts (all free)
GitHub · Google Cloud (Google login) · Slack workspace + Slack API app · ngrok · Loom (or use Google Drive for the video).
Ethereal (the fake SMTP) needs **no account**: the app creates sender accounts automatically.

---

## 2. Install the tools (Windows)

1. **Git**: run the installer, keep all defaults.
2. **Node.js**: run the LTS installer, keep defaults (tick "Add to PATH" if asked).
3. **Docker Desktop**:
   - Run the installer, keep **"Use WSL 2"** ticked. Restart when asked.
   - Open Docker Desktop once and wait until the bottom-left says **Engine running**. Accept the terms. You can skip signing in.
   - If it says *virtualization is disabled*: restart, enter BIOS (usually F2 / F10 / Del), enable **Intel VT-x / AMD SVM (Virtualization Technology)**, save. Search YouTube for your laptop model plus "enable virtualization" if unsure.
   - Docker needs roughly **4 GB of free RAM** for our three services. If your laptop has 4 GB total or Docker refuses to run, use **Appendix A (no Docker)**.
4. **ngrok**: download and unzip or install from the page above, or run `winget install ngrok.ngrok` in PowerShell.
5. Close and **reopen** PowerShell, then verify:

```powershell
node -v          # should print v20 or higher (v22 ideal)
npm -v
git --version
docker --version
ngrok version
```
If any says "not recognized", restart the PC and try again.

**Mac:** install the same tools (Homebrew: `brew install git node ngrok`, plus Docker Desktop from the website). Use `cp` instead of `copy`.

---

## 3. Get the project and install dependencies

1. Unzip `reachinbox-scheduler.zip` somewhere simple, e.g. `C:\Projects\reachinbox-scheduler`.
2. Open PowerShell **in that folder** (in File Explorer: click the address bar, type `powershell`, Enter).
3. Install everything:

```powershell
npm run install:all
```
This takes 1 to 3 minutes.

---

## 4. Start Redis, MySQL and Elasticsearch

Make sure Docker Desktop is running, then:

```powershell
npm run infra:up
docker compose ps
```
You should see `redis`, `mysql`, `elasticsearch` all **running**. Elasticsearch needs about a minute. Check it: open http://localhost:9200 in your browser. A JSON blob means it's ready.

**If a port is already in use** (error mentions 3306 or 6379): you have a local MySQL/Redis running. Either stop that service, or edit `docker-compose.yml` (for example change `"3306:3306"` to `"3307:3306"`) and use the new port in `DATABASE_URL`.

**If Elasticsearch keeps restarting:** Docker is out of memory. Docker Desktop, Settings, Resources, raise Memory to 4 GB or more. (The app still works without Elasticsearch, it falls back to SQL search, but the assignment requires Elasticsearch so get it running.)

---

## 5. First local run (no Google or Slack yet)

1. Create your env file:

```powershell
copy backend\.env.example backend\.env
```
2. Open `backend\.env` in VS Code. For this first test set:

```
APP_URL=http://localhost:4000
FRONTEND_URL=http://localhost:4000
NODE_ENV=development
JWT_SECRET=paste-a-long-random-string
```
Generate a secret with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Leave `REDIS_URL`, `DATABASE_URL`, `ELASTICSEARCH_URL` as they are (they match docker-compose).

3. Build and start:

```powershell
npm run build
npm start
```
You should see logs like `Elasticsearch ready`, `reconcile: 0 pending emails checked`, `worker started`, `API on :4000`.

4. Open **http://localhost:4000**.
5. Test the core flow:
   - On the Login page, use the **email + password** form (any email, password of 6+ characters). It creates your account.
   - Click **Compose**, type 2 or 3 email addresses in To (press Enter after each), a subject, a body, then **Send Now**.
   - The first schedule takes a few seconds because the app creates your Ethereal sender accounts (**needs internet**).
   - Watch **Scheduled** then **Sent**. Click a sent email and use **Open delivered message on Ethereal** to see the actual delivered mail.
   - Open http://localhost:4000/admin/queues (username `admin`, password `admin`) for the BullMQ dashboard.

**If something fails:** read the terminal output (it tells you). Stop the server with `Ctrl + C` and start again with `npm start`. After code changes, run `npm run build` again.

---

## 6. Google login (real OAuth)

Google's console menus get renamed now and then; if a label differs slightly, look for the closest one.

1. Go to https://console.cloud.google.com and sign in.
2. Top bar, project picker, **New Project**, name it `reachinbox-scheduler`, Create, then select it.
3. Left menu: **APIs & Services**, then **OAuth consent screen** (may appear as **Google Auth Platform**). Click **Get started**.
   - App name: `ReachInbox Scheduler`. User support email: yours.
   - Audience: **External**. Contact email: yours. Agree, Create.
4. Go to **Clients** (or Credentials, Create credentials, OAuth client ID):
   - Application type: **Web application**.
   - **Authorized redirect URIs**, add both:
     - `http://localhost:4000/api/auth/google/callback`
     - (you'll add the ngrok one in Section 7)
   - Create. Copy the **Client ID** and **Client secret**.
5. Put them in `backend\.env`:

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```
6. Restart the server (`Ctrl + C`, then `npm start`). Open http://localhost:4000, log out, click **Login with Google**.

**Letting evaluators sign in:** while the app is in **Testing** mode, only accounts listed under **Audience, Test users** can log in. Two options:
- Add the evaluators' emails as test users (if you know them), **and/or**
- Audience, **Publish app** (push to production). With only basic sign-in scopes this normally needs no verification. If Google shows an "unverified app" screen, users click **Advanced, Go to app**.

Evaluators can also simply use the **email + password** form, so they're never blocked.

**Error `redirect_uri_mismatch`:** the URL in your browser/`APP_URL` doesn't exactly match a redirect URI you registered (http vs https, port, trailing slash). Fix one or the other.

---

## 7. Public HTTPS URL (your "hosted link")

Google (non-localhost) and Slack both need an **HTTPS** address. ngrok gives your laptop one.

1. Sign up at https://dashboard.ngrok.com/signup.
2. Dashboard, **Your Authtoken**, copy it:

```powershell
ngrok config add-authtoken YOUR_TOKEN
```
3. Dashboard, **Domains**: your free **dev domain** looks like `something.ngrok-free.app` (or `.dev`). Copy it. It stays the same every time.
4. In a **second** PowerShell window:

```powershell
ngrok http --url=YOUR-DOMAIN-HERE 4000
```
(Use the domain without `https://`.) Leave this window open.
5. Edit `backend\.env`:

```
NODE_ENV=production
APP_URL=https://YOUR-DOMAIN-HERE
FRONTEND_URL=https://YOUR-DOMAIN-HERE
```
6. In Google Cloud, add the redirect URI `https://YOUR-DOMAIN-HERE/api/auth/google/callback` to your OAuth client.
7. Restart the server. Visit `https://YOUR-DOMAIN-HERE`. ngrok shows a one-time "You are about to visit..." page on the free plan; click **Visit Site**. **Mention this in your README** so evaluators aren't confused.

**Keep it alive until you've heard back:**
- Laptop plugged in, **Settings, System, Power: Sleep = Never** (while plugged in).
- Keep 3 things running: Docker Desktop, `npm start` window, `ngrok` window.
- ngrok's free plan has monthly limits (I saw 1 GB data and 20,000 requests). The dashboard auto-refreshes every 5 seconds, so **don't leave many tabs open**.

**Stronger alternative if you have time later:** an always-on VM such as Oracle Cloud Always Free (needs a card for verification; check that your card works and that outbound port 587 isn't blocked). Not realistic before today's deadline.

---

## 8. Slack alerts (required feature)

You need a Slack workspace (create a free one at https://slack.com/create) and a channel like `#alerts`.

1. Go to https://api.slack.com/apps, **Create New App**, **From scratch**. Name `ReachInbox Scheduler`, pick your workspace.
2. Left menu **Incoming Webhooks**, toggle **On**.
3. Left menu **OAuth & Permissions**, **Redirect URLs**, **Add New Redirect URL**: `https://YOUR-DOMAIN-HERE/api/slack/callback`, then **Save URLs**. (Slack wants HTTPS, which is why we did ngrok first.)
4. Left menu **Basic Information**, **App Credentials**: copy Client ID and Client Secret into `backend\.env`:

```
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
```
5. Restart the server. In the app sidebar, under **Slack alerts**, click **Connect Slack**, choose a channel, **Allow**. You're redirected back and see "Slack connected".
6. Click **Send test**. A message must appear in Slack. If yes, the integration works.

For evaluators to connect **their own** Slack, Slack may require enabling **Manage Distribution, Activate Public Distribution**. You only need your own workspace for the video.

---

## 9. Prove every feature (rehearse before recording)

| Feature | How to show it |
|---|---|
| Scheduling (no cron) | Compose, Upload List with `leads.sample.csv`, delay 5, pick **Send Later** a couple of minutes ahead |
| Persistence on restart | See Section 11, step 4 |
| Rate limit + delay + concurrency | Section 11, step 5 |
| Slack on rate-limit hit | Same run; show the Slack message arriving |
| Elasticsearch search | Type part of an address/subject in the search bar; response engine is `elasticsearch` (visible in DevTools, Network) |
| Queue dashboard | `/admin/queues` |
| Multiple senders | Compose, **From** dropdown; rotate across all senders |
| Idempotency | Mention: deterministic job IDs, atomic DB claim, reconcile on boot |

Generate a big lead file: `npm run leads` (creates `leads-1000.csv`).

---

## 10. GitHub

1. Create a repo at https://github.com/new. Name `reachinbox-scheduler`, **Private**, do NOT add README/.gitignore (we have them).
2. In the project folder:

```powershell
git init
git add .
git status
```
**Check that `.env` and `node_modules` are NOT listed.** (`.gitignore` covers them. Committing `.env` would leak your secrets.)

```powershell
git commit -m "Initial commit: email scheduler backend + dashboard"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/reachinbox-scheduler.git
git push -u origin main
```
(GitHub asks you to log in in the browser the first time.)

3. Invite reviewers: repo, **Settings, Collaborators, Add people**: add **Mitrajit** and **Yadav036** (the assignment says to grant both).
4. Nice touch: make a few more small, meaningful commits (for example `git commit -m "Update README with deployment notes"`) rather than one giant commit. The CI workflow in `.github/workflows` runs automatically on push.
5. Open the README on GitHub and confirm the diagram renders. Add a short personal section at the top ("what I built, trade-offs") in your own words.

**Be ready to explain every part of the code in the interview** (how BullMQ delayed jobs work, the Lua rate limiter, the reconcile step). The form asks you to confirm the work is yours, so read through the main files (`worker.ts`, `rateLimiter.ts`, `routes/emails.ts`) until you genuinely understand them, and answer honestly about how you built it.

---

## 11. Record the demo video (max 5 minutes)

Use Loom (free) or Win+G. Keep it under 5:00. **Suggested script:**

1. **(0:00 to 0:30)** Login page, sign in with **Google**. Show name, email, avatar in the sidebar.
2. **(0:30 to 1:30)** Compose: recipients via **Upload List** (`leads.sample.csv`, point at the detected count), subject, body with bold/list, delay 5, hourly limit 50, **Send Later** a few minutes ahead. Click it.
3. **(1:30 to 2:15)** Scheduled tab (orange time pills), then Sent tab after emails go out, open one and click the Ethereal preview. Show search.
4. **(2:15 to 3:15) Restart test:** Schedule a few emails ~2 minutes ahead. In the terminal press `Ctrl + C` to stop the server. Say what you're doing. Run `npm start` again. The emails still send on time. (Optional extra proof: `docker compose restart redis` while jobs are queued.)
5. **(3:15 to 4:30) Load / rate limit:** Compose, upload `leads-1000.csv`, delay 0, **hourly limit 10**. Schedule. Show `/admin/queues` (jobs draining at the configured delay, rest moved to delayed), and the **Slack message** arriving. Explain: nothing is dropped, leftovers are rescheduled into the next hour window in order.
6. **(4:30 to 5:00)** Flash the README architecture section.

**Share the video:** Loom, Share, link visible to anyone with the link. Or Google Drive, Share, **Anyone with the link, Viewer**. Test the link in an **incognito window**.

Tip: before recording, for a faster load demo you can set `MIN_DELAY_BETWEEN_SENDS_MS=500` in `.env`.

---

## 12. Submit

Form (from the placement email): https://forms.gle/kU4MbbWCrFJqdc25A (the company form: https://forms.clickup.com/9005062261/f/8cbwp3n-8876/6NNNJ92DV93PQTAYST).

Fields to prepare:
- Full name, phone, email, college, batch, CGPA, attendance.
- Resume (PDF) and cover letter.
- LinkedIn, other links (GitHub profile).
- **Hosted link**: `https://YOUR-DOMAIN-HERE`
- **Assignment GitHub repo** link.
- **Demo video** link.
- Confirm reviewers invited: `mitrajit` and `Yadav036`.

**Before you click submit, test all three links in an incognito window:**
- Hosted link loads the login page (click through the ngrok notice).
- GitHub repo: you're logged in as owner so it works; double-check Collaborators lists both reviewers.
- Video plays without login.

Do not change the links after submitting.

---

## 13. Troubleshooting

| Problem | Fix |
|---|---|
| `docker: command not found` / daemon not running | Open Docker Desktop, wait for "Engine running" |
| Port 3306 / 6379 already in use | Stop local MySQL/Redis or change the port mapping in `docker-compose.yml` and `.env` |
| `ECONNREFUSED 127.0.0.1:3306` when starting | MySQL container not ready yet (wait 30 s) or not running (`docker compose ps`) |
| Elasticsearch unavailable in logs | Wait a minute and restart the app; raise Docker memory. App falls back to SQL search meanwhile |
| Schedule fails with `EFETCH` / 500 | No internet: app couldn't create Ethereal accounts. Check connection and retry |
| Emails stay "scheduled" | Worker not running (`RUN_WORKER` must not be `false`) or the start time is in the future |
| `redirect_uri_mismatch` (Google) | Redirect URI in Google console must exactly match `APP_URL` + `/api/auth/google/callback` |
| Login works but you bounce back to login on the ngrok URL | `APP_URL`/`FRONTEND_URL` still localhost, or `NODE_ENV` not `production`; restart after editing `.env` |
| Slack "Connect" does nothing / error | Redirect URL not saved in Slack app, wrong client ID/secret, or still using http |
| Changes to code not showing | `npm run build` then restart `npm start` |
| Blank page at a deep link | Make sure you ran `npm run build` (the server serves the built frontend) |

---

## Appendix A: No Docker (cloud data services instead)

Use this if Docker won't run on your laptop. You still run the app locally + ngrok; only Redis, MySQL and Elasticsearch are hosted for free. Everything else in this guide is identical.

**MySQL and Redis: Aiven free tier** (no card; one free service of each type, as of my check):
1. Sign up at https://console.aiven.io.
2. Create a **MySQL** service on the **free plan**. When running, copy host, port, user, password. In `backend\.env`:
```
DATABASE_URL=mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb
DATABASE_SSL=true
```
3. Create a **Valkey** service (Redis-compatible) on the free plan. Copy its **Service URI** (starts with `rediss://`):
```
REDIS_URL=rediss://default:PASSWORD@HOST:PORT
```
If the app logs an eviction-policy warning, set the Valkey max-memory policy to `noeviction` in the service's advanced settings.

**Elasticsearch: Elastic Cloud 14-day free trial** (no card reported):
1. Sign up at https://cloud.elastic.co and create a **hosted deployment** (smallest size).
2. Copy the **Elasticsearch endpoint** URL and create an **API key** (Kibana, Stack Management, API keys, or from the deployment page):
```
ELASTICSEARCH_URL=https://YOUR-DEPLOYMENT.es.REGION.cloud.es.io:443
ELASTICSEARCH_API_KEY=your-encoded-api-key
```
The trial lasts 14 days. If it expires, the app automatically falls back to SQL search.

Then skip Section 4 and continue from Section 5. **Free plans and trial terms change, so double-check on each site.**

---

## Appendix B: Interview talking points

- **Why BullMQ delayed jobs instead of cron?** Persisted in Redis; timing is per job; survives restarts; scales with workers.
- **Exactly-once?** Deterministic `jobId`, status check, atomic `UPDATE ... WHERE status='scheduled'` claim, startup reconcile. Honest trade-off: at-least-once in a crash between SMTP accept and DB update.
- **Rate limit correctness across workers?** Redis Lua script does INCR + compare + rollback atomically per sender per hour window.
- **What happens at the limit?** Job is moved to the next hour window (not dropped), staggered by original position to preserve order; Slack is notified once per sender per window (Redis `SET NX`).
- **Why MySQL as source of truth?** If Redis is wiped, reconcile rebuilds jobs from DB.
- **Search:** Elasticsearch index updated on every status change; SQL fallback.
- **Security:** JWT in httpOnly cookie, scrypt password hashing, Google ID-token verification, OAuth state checks, HTML sanitized with an allow-list, Bull Board behind basic auth.
- **What would you do next?** Encrypt SMTP credentials, per-tenant limits, provider webhooks for bounces, attachments, tests in CI with service containers.
