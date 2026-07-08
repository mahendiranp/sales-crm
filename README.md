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
signed JWT, and passwords are stored in plaintext in the JSON file DB. Swap
in real hashing (bcrypt/argon2) and signed session tokens before using this
with real customer data.

## Stack

- **Monorepo:** Turborepo + npm workspaces
- **apps/backend:** Node.js + Express, with a lightweight JSON-file database
  (no native modules, no external DB server required — runs anywhere Node runs)
- **apps/web:** React (Vite) + Tailwind CSS + Recharts + React Router

## Project structure

```
sales-crm/
├── turbo.json                 # pipeline config (dev, build, lint)
├── package.json                # root workspace + scripts
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── index.js        # Express server entry point
│   │   │   ├── db/
│   │   │   │   ├── store.js    # JSON-file data store
│   │   │   │   ├── seed.js     # Sample data (leads, deals, users, etc.)
│   │   │   │   └── data/db.json  # created on first run
│   │   │   └── routes/         # one file per module
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── pages/          # one file per module
│       │   ├── components/     # Layout, PipelineFunnel, shared UI
│       │   ├── api/client.js   # axios API client
│       │   └── App.jsx
│       ├── vite.config.js      # proxies /api to the backend
│       └── package.json
```

## Getting started

You'll need [Node.js](https://nodejs.org) 18+ installed.

From the repo root:

```bash
npm install
npm run dev
```

That's it — `npm run dev` runs `turbo run dev`, which starts **both** apps
in parallel:
- API on **http://localhost:4000** (seeds sample data into
  `apps/backend/src/db/data/db.json` on first run — delete that file any
  time to reset)
- Web app on **http://localhost:5173**, which proxies all `/api/*`
  requests to the backend automatically

Open **http://localhost:5173** in your browser.

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
