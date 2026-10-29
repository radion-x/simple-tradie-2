# Simple Page Tradie

Target: https://tradie.simplepage.com.au
Repository: radion-x/simple-tradie-2
Branch: codex/tradie-repair

This rebuild uses the current working shared application core from `radion-x/msr-2026-sep` at `6f31eba` (27 October 2026). See `REBUILD_REVIEW.md` for source lineage, verification and release requirements.

## Run

Node 20 or later and PostgreSQL are required. Copy `.env.example` into a private `.env`, configure a site-specific database and the approved server-side service credentials, then:

```sh
npm ci
npm run db:migrate
npm start
```

Migrations are explicit and must run before deployment. Startup does not alter the schema. `/health` checks database availability.

## Verify

Use a disposable local PostgreSQL database whose name ends in `_test`. The integration suite clears that database's public schema. It refuses remote databases and any other database name.

```sh
TEST_DATABASE_URL=postgresql://USER@127.0.0.1:PORT/simple_page_tradie_test npm test
npm audit
```

The tests mock AI and email delivery while exercising actual database writes, migrations, authentication and HTTP endpoints.

`PREVIEW_MODE=isolated DATABASE_URL=..._test PORT=3150 node scripts/preview.js` starts the visibly labelled local review. AI and email are simulated. No external email leaves that process.

The provider evaluation scripts require the explicitly authorised local Keychain credentials. They must not be used as ordinary automated tests or without a spending ceiling. The dedicated production key is stored in macOS Keychain under service `openrouter-tradie-simplepage-api-key`, account `rad`. Retrieve it privately at runtime. Never put it in browser code, tracked files or terminal output.

## Endpoints

- POST `/api/send-email`: website enquiry
- POST `/api/chat`: streamed or JSON assistant reply and approved tools
- POST `/api/chat/callback`: explicit callback form
- POST `/api/chat/email-transcript`: consented conversation email request
- `/api/admin/*` and `/api/callbacks*`: shared magic-link dashboard

Enquiries save before notifications. Responses report whether the staff notification and customer email were accepted by the mail adapter. They do not certify inbox delivery. Repeated form requests use an event ID to prevent duplicate leads and repeated email. A callback request never confirms an appointment or project booking.
