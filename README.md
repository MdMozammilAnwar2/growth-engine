# Growth Engine

Turn a LinkedIn profile into a polished portfolio site, gift it to the person on a
private preview link, publish it to GitHub Pages only after they say yes, and track
the work that comes back.

```
growth-engine/
├── server/       Node.js + Express + Sequelize + PostgreSQL (API, AI agents, preview pages)
├── web/          React + Vite + Tailwind CSS (works on phone and desktop, installable)
└── mobile-app/   Capacitor wrapper that builds the web app into an Android app
```

## How it works

1. **Add a person**: upload their LinkedIn PDF (computer) or 2–3 profile screenshots (phone).
2. **Extractor** reads the files into structured data. **You review** it.
3. **Writer** rephrases the copy (never adds facts), **Builder** renders one of three
   tested templates, **QA** checks layout at 360 / 390 / 768 / 1440 px.
4. **You approve the preview**. **Outreach** drafts the message; you send it from WhatsApp,
   LinkedIn or email.
5. Your friend opens the private link and taps **Publish it**, **Request changes** or **No thanks**.
6. After their yes, **you approve publishing**. **Publisher** creates a GitHub repo, commits the
   site and turns on GitHub Pages.
7. Replies that turn into work go on the **Leads** board.

Nothing is sent and nothing goes public without your tap. "No thanks" profiles are deleted
after 30 days.

## Run it on your computer

Requirements: Node.js 20+ and PostgreSQL (user `postgres`, password `admin`, as in `server/.env`).

```bash
# 1. API (creates the "growth_engine" database and tables on first start)
cd server
npm install
#    open server/.env: set ADMIN_PASSWORD, and optionally ANTHROPIC_API_KEY and GITHUB_TOKEN
npm run dev                # http://localhost:4000

# 2. Web app (in a second terminal)
cd web
npm install
npm run dev                # http://localhost:5173
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `server/.env`.

Optional: `cd server && npm run seed` adds two demo people (named "Demo …") to try the flow.

**On your phone (same Wi-Fi):** open `http://<your-computer-ip>:5173`. To make preview links
work on phones too, set `PUBLIC_BASE_URL=http://<your-computer-ip>:4000` in `server/.env`.

## Settings (`server/.env`)

| Key | What it does |
| --- | --- |
| `DB_*` | PostgreSQL connection. The database is created automatically. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Your login. **Change the password.** |
| `JWT_SECRET` | Long random string for sessions. |
| `PUBLIC_BASE_URL` | Address of the server that friends can reach. Preview links use it. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Optional AI. Without it, PDFs use a built-in parser and messages use plain templates. Screenshots need it. |
| `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_OWNER_TYPE` | Publishing. Use a separate GitHub org/account for portfolios. Classic token with `repo` scope, or fine-grained with Administration, Contents and Pages (read/write). |
| `CREDIT_NAME`, `CREDIT_URL`, `CREDIT_LINE` | The "Crafted by …" line on every site. |
| `DECLINE_RETENTION_DAYS` | Days before "No thanks" data is deleted (default 30). |

### Layout checks in a real browser

QA always runs static checks. For the overlap / sideways-scroll checks at four screen sizes:

```bash
cd server && npx playwright install chromium
```

(Or set `CHROME_PATH` to an installed Chrome.)

## Put it online

Friends can only open preview links if the server is reachable on the internet.

1. Get a small VPS (or Render / Railway) with Node 20 and PostgreSQL.
2. `cd web && npm install && npm run build`. The server automatically serves `web/dist`,
   so one Node process serves the app, the API and the preview pages.
3. In `server/.env`: `NODE_ENV=production`, `PUBLIC_BASE_URL=https://your-domain`,
   `CORS_ORIGINS=https://your-domain`, strong `ADMIN_PASSWORD` and `JWT_SECRET`.
4. `cd server && npm install --omit=dev && npm start` (keep it running with `pm2` or systemd),
   behind HTTPS (Caddy or Nginx).
5. Open `https://your-domain` on your phone › **Add to Home screen**.

Uploaded files and built sites are stored in `server/storage/`. Back it up with the database.

## API overview

All routes need `Authorization: Bearer <token>` except the public preview ones.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in |
| GET/POST | `/api/contacts` | List / add a person (multipart: `files[]`, `photo`, fields) |
| GET/PATCH/DELETE | `/api/contacts/:id` | Detail / edit / delete (deletes files too) |
| PUT | `/api/contacts/:id/profile` | Save reviewed profile (`{data, reviewed}`) |
| POST | `/api/contacts/:id/extract` | Re-run the Extractor |
| POST | `/api/contacts/:id/photo` | Replace photo (upload or `photoUrl`) |
| POST | `/api/contacts/:id/build` | Writer + Builder + QA (`{templateId, tone}`) |
| GET | `/api/approvals` | Preview, publish and changes queues |
| POST | `/api/sites/:id/approve-preview` · `send-back` · `approve-publish` · `takedown` | Your gates |
| GET | `/api/messages/queue` | Who needs a message |
| POST | `/api/contacts/:id/messages/draft` | Draft a message (`{templateKey, channel}`) |
| PATCH / POST | `/api/messages/:id` · `/api/messages/:id/sent` | Edit / mark as sent |
| CRUD | `/api/leads` | Leads board |
| GET | `/api/dashboard`, `/api/settings` | Home screen data, integration status |
| GET | `/p/:token/` | **Public** private-preview page with the consent sheet |
| POST | `/api/public/consent/:token` | **Public** answer: `publish`, `changes` (+ message, photo) or `decline` |

## Data model

`contacts` → `source_files`, `profiles` (versioned JSON), `sites` (versioned; content, preview token,
QA report) → `approvals`, `consents`, `deployments`; plus `messages`, `leads`, `activities`, `templates`.
Tables are created and updated automatically with Sequelize `sync({ alter: true })`.

## Rules worth keeping

- Don't automate LinkedIn (no bots or scraping). Download PDFs or take screenshots yourself.
- First message is a gift, not a pitch. One nudge at most.
- Publish only after their "yes"; take a site down whenever someone asks.
