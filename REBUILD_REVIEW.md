# Tradie rebuild review, 29 October 2026

## Target and foundation

The correct target is `radion-x/simple-tradie-2`, live at https://tradie.simplepage.com.au, Coolify application `okcwsokckc0sc44cgcs444kk`. Its original head is `9759956`, dated 23 December 2025.

The selected working base is `radion-x/msr-2026-sep` at `6f31eba`, dated 27 October 2026. `DEVELOPMENT.md` identifies this app as an independent derivative of `radion-x/elite-zoom-cleaning-toothbrush-offer`, created 30 September 2026. Its complete existing test suite passed all 12 checks against an isolated verification database before reuse. The general Simple Page application has older August history. The saved “Websited My Site” workspace has no committed application and cannot establish a newer working base.

The first draft selectively reused older Simple Page components. After the base choice was clarified, that draft's simplified chat was replaced with the verified current app's actual chat implementation and client. The finished foundation reuses:

- Tool-capable streaming and JSON AI routes, full conversation context and UTF-8 stream decoding.
- The working chat client, suggested questions, inline callbacks and transcript flow.
- Shared lead validation and capture, attribution, idempotency, notification state and native Mailgun recipient routing.
- Passwordless staff authentication and the current escaped lead dashboard.
- Explicit database migrations, branded email helpers and HTML injection controls.

Adaptations are specific to this deployment: Simple Page facts, prices, contact details, offer, visual system, database upgrade path, consented transcript endpoint and isolated admin cookie. Vehicle quote fields and damage-photo intake are not exposed on a website sales page. The shared attachment table is preserved by the imported upgrade migration for compatibility; no MSR database, photos, customers or credentials are copied.

## Changes and checks

The new page uses the existing Simple Page portfolio assets for River City Handyman, Harbour Town Handyman and VIP Roofing Supplies. The live published Tradie offer is retained: $997 setup plus $30/month, including three pages. The old ad's $600 price and illustrative $699 discussion are not substituted. GST, domain costs, final scope, timing and ongoing terms need written confirmation with each customer.

Removed unsupported launch, lead, ranking and competitor-cost claims. Corrected canonical metadata to the actual Tradie hostname. The short enquiry path accepts a phone number or email and records contact consent. Useful old entry URLs redirect to the current page; stale template backups are blocked. Desktop and 390px phone layouts, chat success and failure, callback and transcript forms, primary enquiry and actual saved test records were inspected in the integrated browser.

Tests exercise fresh schema, legacy upgrade with a preserved lead, repeat migration, real PostgreSQL saves, retry deduplication, validation, notification failures, database failures, transcript source, provider failures, callback tools, streaming UTF-8, single-use/expired magic links, logout and denied admin access. They send no real email. Dependency audit is clean.

Additional fixes made while porting the shared app: no private debug transcript files; provider errors remain readable after SSE headers are sent; a failed callback cannot be described to the model as saved; tool callbacks require explicit consent and have deterministic retry references; marketing snippets are excluded from staff pages.

## AI

The live deployment's old key is named AO Contracting. Read-only inspection confirmed a $1 lifetime cap, no reset, and approximately $1.014 usage. This explains the rejected live chat requests. The old key has not been changed or revoked.

The user approved a dedicated Tradie key with a US$5 monthly cap and GPT-5.4 Mini. Provisioning uses the management credential privately, stores the plaintext only in Keychain/server-secret configuration and assigns a key-only model allowlist. No credits purchase or account-wide policy change is authorised.

The initial small comparison cost US$0.0043799. It exposed ownership wording gaps and an output cap that truncated one reply. The final GPT sample uses the corrected prompt. The three completed final samples consumed 711-719 input and 60-102 output tokens, with no reported reasoning tokens, at US$0.00080925-0.00099525 per request. Times were 1.152-1.276 seconds in this tiny sample. A further cross-provider run was interrupted when the user selected GPT, so the saved sample report is not a complete account billing ledger.

`outputs/provider-app-verification.json` records a genuine GPT streamed callback through the reused app, with a saved test lead and confirmation wording. Email in that check was simulated. Synthetic prompts contain no customer data. Real traffic, longer histories and tool follow-ups change costs. A cap is a ceiling, not a recurring flat fee.

## Release status and remaining verification

The review server is http://localhost:3150. Its banner identifies simulated AI/email. Screenshots are in `outputs/`. No public website release has been made as part of preparing the review. The approved dedicated key and GPT configuration have been saved and privately verified in the actual Tradie Coolify application, but are not active in the running container. Automatic approval review rejected the production restart because activation can briefly interrupt the live site and was not included in the key-configuration approval. Explicit restart approval is required. No alternate activation was attempted.

Before release:

1. Confirm the dedicated key and GPT model are in the verified Tradie server configuration, without copying another site's service keys.
2. Verify the existing Tradie database and notification recipients privately. Back up the actual target database, then run the reviewed migrations on that database. Do not replace it with any source app database.
3. Release the reviewed branch using the existing Coolify deployment convention. Pushing main automatically deploys, so do not use main for staging.
4. Smoke-test production chat and a controlled owner enquiry, then verify the stored lead, staff notification, customer receipt and Mailgun delivery events. Adapter acceptance alone does not prove inbox arrival.

Production notification delivery and the actual upgraded production database remain unverified until those release checks. The original live site is still separate from the local review.
