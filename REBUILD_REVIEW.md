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

The new page uses the existing Simple Page portfolio assets for River City Handyman, Harbour Town Handyman and VIP Roofing Supplies. The live published Tradie offer is retained: $997 setup plus $30/month, including three pages. The old ad's $600 price and illustrative $699 discussion are not substituted. Rad confirmed on 29 October 2026 that both prices include GST. Domain costs, final scope, timing and ongoing terms still need written confirmation with each customer.

Removed unsupported launch, lead, ranking and competitor-cost claims. Corrected canonical metadata to the actual Tradie hostname. The short enquiry path accepts a phone number or email and records contact consent. Useful old entry URLs redirect to the current page; stale template backups are blocked. Desktop and 390px phone layouts, chat success and failure, callback and transcript forms, primary enquiry and actual saved test records were inspected in the integrated browser.

Tests exercise fresh schema, legacy upgrade with a preserved lead, repeat migration, real PostgreSQL saves, retry deduplication, validation, notification failures, database failures, transcript source, provider failures, callback tools, streaming UTF-8, single-use/expired magic links, logout and denied admin access. They send no real email. Dependency audit is clean.

Additional fixes made while porting the shared app: no private debug transcript files; provider errors remain readable after SSE headers are sent; a failed callback cannot be described to the model as saved; tool callbacks require explicit consent and have deterministic retry references; marketing snippets are excluded from staff pages.

## AI

The live deployment's old key is named AO Contracting. Read-only inspection confirmed a $1 lifetime cap, no reset, and approximately $1.014 usage. This explains the rejected live chat requests. The old key has not been changed or revoked.

The user approved a dedicated Tradie key with a US$5 monthly cap and GPT-5.4 Mini. Provisioning uses the management credential privately, stores the plaintext only in Keychain/server-secret configuration and assigns a key-only model allowlist. No credits purchase or account-wide policy change is authorised.

The initial small comparison cost US$0.0043799. It exposed ownership wording gaps and an output cap that truncated one reply. The final GPT sample uses the corrected prompt. The three completed final samples consumed 711-719 input and 60-102 output tokens, with no reported reasoning tokens, at US$0.00080925-0.00099525 per request. Times were 1.152-1.276 seconds in this tiny sample. A further cross-provider run was interrupted when the user selected GPT, so the saved sample report is not a complete account billing ledger.

`outputs/provider-app-verification.json` records a genuine GPT streamed callback through the reused app, with a saved test lead and confirmation wording. Email in that check was simulated. Synthetic prompts contain no customer data. Real traffic, longer histories and tool follow-ups change costs. A cap is a ceiling, not a recurring flat fee.

## Live release, 29 October 2026

Explicit approval to deploy and activate GPT was received. Live URL: https://tradie.simplepage.com.au. Coolify deployment `ozfedqtnte9yep0xjfuioekh` finished at 02:57 UTC with revision `b5e08d798f40e91a237b7523c4d2a280c30c5106`. Final state is `running:healthy`, with `/health` enabled. The first deployment failed because a literal multiline environment override was invalid; a single-line fallback corrected it. The reviewed versioned prompt remains active.

Before migration, native database backup `fpxemslytnbvy8j3ygqfnz0e` succeeded (13,162 bytes). It is a local Coolify backup, with no offsite copy verified. All nine additive migrations succeeded. The seven original enquiries remained byte-equivalent under the recorded field fingerprint, both after migration and after acceptance. The disabled one-off release task and disabled backup configuration are retained for audit; neither runs on a schedule.

GPT-5.4 Mini is active. The dedicated key matches secure Keychain configuration and has a US$5 monthly cap. The prior AO Contracting key was not changed. The broken legacy Mailgun credentials were replaced with a dedicated sending-only key for verified `mgun.websited.org`. Existing staff recipients Jack and hello@simplepage.com.au are preserved; the stale alternative recipient setting was corrected.

Controlled live owner tests saved SP-8 (form), SP-10 (GPT callback tool) and SP-11 (transcript), with campaign attribution and notification status. Retrying SP-8 returned the same reference. GPT streamed the reviewed offer and declined to promise a launch date. Staff session creation, link replay denial, authorised record reads and logout passed through actual server routes. The emailed magic link was delivered separately; the authentication test consumed a privately issued test link inside the container. All three labelled test records are closed, with no change to real customer stages.

Mailgun recorded remote 250 delivery for all staff notifications and customer receipts, plus the staff magic link. Six test copies inspected in the connected owner Gmail mailbox carried the SPAM label. SPF and DKIM pass. No DMARC TXT record was found at the sending subdomain or organisational domain. The cause of Gmail classification is not proven, and inbox placement remains unresolved. No personal allowlisting or DNS policy changes were made. Do not describe remote delivery as inbox success.

Live desktop and 390px mobile visuals passed, including the sticky callback return button. No local review banner appears in production. The isolated preview remains simulated and separate. `outputs/live-release-verification.json` contains the release evidence, with live screenshots alongside it. No Gumtree publication or advertising spend occurred. Analytics events remain local `dataLayer` events without a connected reporting destination.

## Email placement follow-up, 29 October 2026

A narrow search in the existing authenticated Jack Gmail account showed all four Simple Page tests in **Inbox**: staff notifications SP-8, SP-10, SP-11, and the admin sign-in link. Screenshot: `outputs/jack-owner-tests-inbox.jpg`. This corrects the earlier overly broad implication that all staff recipients had a spam problem.

The three direct customer receipts to radion@websited.org are in Spam. The three staff copies addressed to hello@simplepage.com.au were forwarded through Cloudflare Email Routing to radion@websited.org and are also in Spam. Headers verify this forwarding route and show SPF/DKIM/ARC passing at Google. The Simple Page address is a forwarding route, rather than a separately inspected mailbox. Jack's direct copies were not inferred from Rad's forwarded copies.

Sender From, SPF envelope and DKIM signing domains align on mgun.websited.org. Staff Reply-To uses the submitted customer's address, and customer receipts reply to hello@simplepage.com.au. The Mailgun domain is active and enabled. HTML has a plain-text alternative and real business contact details. No concrete site-specific sender/content defect was established, so this follow-up made no production code, sender, DNS or mailbox-filter change and sent no additional test messages. Gmail classification differs between recipient accounts; its exact cause remains unknown. Domain/IP reputation is a possible factor, not a verified diagnosis.

Operational handover: bookmark https://tradie.simplepage.com.au/admin/callbacks.html. Existing authorised sign-ins are Jack's Gmail and hello@simplepage.com.au. Sign-in links last 15 minutes; sessions last eight hours. Rad can use the hello address and check his Spam folder for its forwarded sign-in link. Check **Pending**, press **Apply Filters**, and **Refresh** at the start and end of the working day. The dashboard is the persistent enquiry record even when a notification is filtered or fails. Contacted/completed status does not mean a job was paid.

Rad may manually mark the known expected test messages Not spam in his own mailbox. This provides feedback for that mailbox and does not prove a general deliverability fix. If real transactional messages continue to be filtered, the next concrete escalation is Mailgun support with existing Message-IDs, sender domain, sending IP 159.135.228.4 and passing authentication results. A sending-domain DMARC review is also appropriate, but the shared domain's policy was not changed under this site release. No inbox guarantee is made.

References: [Google sender guidelines](https://support.google.com/mail/answer/81126?hl=en), [Mailgun reputation guidance](https://documentation.mailgun.com/docs/mailgun/email-best-practices/reputation), [Mailgun IP guidance](https://documentation.mailgun.com/docs/mailgun/email-best-practices/ip_address).

## GST clarification, 29 October 2026

Rad confirmed the $997 build and $30/month hosting and AI prices both include GST. The page hero, package card, monthly FAQ, enquiry introduction, metadata and authoritative assistant prompt now state this. Totals and other terms are unchanged. Receipts do not quote package prices, so no receipt change is required.

GST clarification deployed successfully as `c517727e2f920a011714a2d78fb48f2b85a12124` (Coolify `rw0devkgusekcpiqirbmeb7q`). Published hero/package/FAQ/enquiry text and 390px layout verified. One short live GPT check confirmed both prices include GST with no extra GST charge. Health remained OK. No enquiries or emails were created. Evidence: `outputs/gst-live-verification.json`.
