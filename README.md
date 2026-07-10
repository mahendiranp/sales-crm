# Pipeline — Sales CRM with AI

A full-stack Sales CRM covering all 16 modules: Dashboard, Leads, Contacts,
Companies, Deals, Activities, Tasks, WhatsApp, Email, Templates, Analytics,
Sales Reports, Performance, Users, Teams, and Settings.

Structured as a **Turborepo monorepo** (npm workspaces + Turbo pipelines).

## Accounts & roles

The app now has a marketing home page, sign up, and login — with three
permission tiers:

| Role | Can do |
|---|---|
| **Admin** | Everything, including Settings |
| **User (Manager)** | Manage leads, deals, tasks, messaging, etc. |
| **Viewer** | Browse everything, but cannot create/edit/delete anything |

Demo accounts (seeded automatically) — pick one on the login screen, or
sign in manually:

- `admin@pipeline.com` / `admin123`
- `manager@pipeline.com` / `manager123`
- `viewer@pipeline.com` / `viewer123`

Viewer restrictions are enforced on **both** ends: the frontend hides
Add/Edit/Assign/Convert/Send controls, and the backend rejects any
mutating request from a viewer with a 403 (see
`apps/backend/src/middleware/auth.js`). This is demo-grade auth — roles are
trusted from a request header set by the logged-in session rather than a
signed JWT, and passwords are stored in plaintext in MongoDB. Swap
in real hashing (bcrypt/argon2) and signed session tokens before using this
with real customer data.

## Stack

- **Monorepo:** Turborepo + npm workspaces
- **apps/backend:** Node.js + Express + MongoDB (via the official `mongodb`
  driver), with Socket.IO broadcasting live updates to every connected client
- **apps/web:** React (Next.js) + Tailwind CSS + Recharts, with a
  `socket.io-client` connection for real-time updates

## Project structure

```
sales-crm/
├── turbo.json                 # pipeline config (dev, build, lint)
├── package.json                # root workspace + scripts
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.js        # Express + Socket.IO server entry point
│   │   │   ├── db/
│   │   │   │   ├── store.js    # MongoDB-backed data store, emits live updates
│   │   │   │   └── seed.js     # Sample data (leads, deals, users, etc.)
│   │   │   └── routes/         # one file per module
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── pages/          # one file per module
│       │   ├── components/     # Layout, PipelineFunnel, shared UI
│       │   ├── lib/socket.js, useLiveCollection.js  # real-time client
│       │   ├── api/client.js   # axios API client
│       │   └── App.jsx
│       ├── next.config.mjs     # proxies /api to the backend
│       └── package.json
```

## Getting started

You'll need [Node.js](https://nodejs.org) 18+ and [MongoDB](https://www.mongodb.com/try/download/community)
installed and running locally (`mongod` listening on `127.0.0.1:27017`).
Point the backend at a different instance with a `MONGODB_URI` env var if
needed — it defaults to `mongodb://127.0.0.1:27017/sales_crm`.

From the repo root:

```bash
npm install
npm run dev
```

That's it — `npm run dev` runs `turbo run dev`, which starts **both** apps
in parallel:
- API on **http://localhost:4000** (seeds sample data into the `sales_crm`
  Mongo database on first run — drop the database any time to reset:
  `mongosh sales_crm --eval "db.dropDatabase()"`). Also runs a Socket.IO
  server on the same port, broadcasting live updates to every connected client.
- Web app on **http://localhost:3000**, which proxies all `/api/*`
  requests to the backend automatically and connects directly to the
  backend for real-time updates

Open **http://localhost:3000** in your browser.

### Running an app individually

```bash
npx turbo run dev --filter=@sales-crm/backend
npx turbo run dev --filter=@sales-crm/web
```

### Building

```bash
npm run build
```

## What's real vs. mocked

Everything is backed by real API endpoints and a real (file-based) database —
adding a lead, converting it to a contact, moving a deal through the pipeline,
completing a task, sending a WhatsApp message, all persist and reload correctly.

Two things are intentionally simplified since they'd otherwise require paid
third-party accounts to demo:

- **AI Suggestions / AI Reply Suggestions** use a small rule-based engine
  (see `apps/backend/src/routes/dashboard.js` and
  `apps/backend/src/routes/whatsapp.js`) instead of a live LLM call. To wire
  in a real model, add an API key under **Settings → AI Configuration** and
  swap `generateAiSuggestion()` for a call to your LLM provider of choice.
- **WhatsApp/Email sending** writes to the local message log instead of
  calling the WhatsApp Business API or an SMTP provider. Plug in real
  credentials under **Settings → WhatsApp API / Email Settings** and wire
  them into `apps/backend/src/routes/whatsapp.js` / `email.js`.

## Real-time updates

Every write goes through `apps/backend/src/db/store.js`, which broadcasts a
Socket.IO event after each insert/update/remove. The frontend's
`useLiveCollection` hook (`apps/web/src/lib/`) subscribes per page and
reloads automatically — open the same page in two tabs and changes in one
show up in the other without a refresh, including the Admin Portal's
feature-flag toggles updating every open session's sidebar live.

## Sales Reports exports

The **Sales Reports** module generates real files on request:
- **Excel** — genuine `.xlsx` via SheetJS
- **PDF** — genuine `.pdf` via PDFKit

Both are generated live from current data, not static templates.

## Design

Primary color is a deep teal (`#2F5D50`, trust/growth), with warm amber
(`#E8A33D`) for CTAs and "won" deal states. Headings use Sora, body text
uses Inter, and currency/data figures use JetBrains Mono. The sales pipeline
(New Lead → Qualified → Meeting Scheduled → Quotation Sent → Negotiation →
Won/Lost) is rendered as a funnel visualization on the Deals page — the
one recurring visual signature tied to the CRM's actual backbone.
