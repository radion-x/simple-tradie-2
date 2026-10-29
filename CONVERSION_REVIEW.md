# Conversion review, 29 October 2026

## Objective and evidence

Aim: two additional paying website projects a week, within actual delivery capacity and margin. A form submission, chatbot interaction, quote and paying job are distinct stages.

Evidence available: the expired general Gumtree ad had 29 visits and zero Gumtree replies. Jack's earlier tradie ad produced three preserved enquiry conversations and, by Rad's confirmation, no paid jobs. There is no measured website conversion baseline, reliable historical promotion cost or evidence supporting an uplift forecast. Two of the preserved conversations had no visible Gumtree reply; follow-up elsewhere is unknown. Follow-up deserves at least as much attention as the page.

The shared Matraville application core remains in place. No production restart, deployment, migration, advertising spend or prospect communication occurred during this review.

## Implemented changes

| Before | After | Reason to test |
|---|---|---|
| Hero slogan did not explicitly identify the service | “Websites for Sydney tradies.” | Match the Gumtree title and immediately identify audience and service |
| Both charges appeared in small supporting text | $997 build and $30/month are explicit, with three-page scope alongside them | Reduce price ambiguity before the enquiry |
| Portfolio screenshots opened only as images | Verified River City and Harbour Town examples link to their sites in new tabs; the VIP example remains a clearly labelled portfolio image | Let visitors inspect real work without losing their enquiry page |
| A written brief was compulsory | Name, one contact method and contact consent are enough; trade/service area and existing-site details are optional | Start a useful conversation without demanding an essay |
| Phone-only enquiry defaulted to email follow-up | Phone-only submissions now record phone as the contact method | Make the saved lead actionable |
| Floating assistant could cover phone form controls | Widget hides while the contact section is in view; an inline assistant button remains available | Keep the enquiry path clear |
| Callback view could feel trapped when scrolled | Sticky “Back to chat” button, Escape returns to the conversation, one panel at a time | Provide a visible exit without submitting or losing drafts |
| Generic failure handling and retry ambiguity | Invalid contact field receives focus; drafts survive failure; saved requests, duplicate retries and notification failures have distinct results | Avoid lost enquiries and misleading confirmations |
| Campaign context was easy to lose or overlook | First entry tags survive same-tab navigation and reach forms, transcript and tool callbacks, staff email and dashboard | Link enquiries to their actual acquisition source |
| Dashboard still attempted vehicle-photo requests | Irrelevant requests removed; notification failure and acquisition context are visible | Reduce operator confusion during follow-up |

These are usability and message improvements to validate with real traffic. They are not measured conversion gains.

## Exact offer and ad alignment

- Service: websites for Sydney tradies. The completed Gumtree title is “Websites for Sydney Tradies | $997 + $30/month”.
- Price: $997 build plus $30/month for hosting and AI. Keep both together in the ad and artwork.
- Scope: three custom pages, mobile layout, services/work/contact information, enquiry form, click to call, approved-information assistant, callback capture and private enquiry dashboard. Agree the actual content and scope before work begins.
- Website primary CTA: “Discuss my website”. Form action: “Send my website enquiry”.
- Gumtree CTA: “Message your trade and suburb”. Then establish whether they need a first website or an update. A Gumtree message can qualify the lead directly; a website visit is not mandatory.
- Proof: actual portfolio work. Do not imply portfolio results, enquiry counts or testimonials that have not been verified.
- The current separately owned deliverables/primary-ad.txt was read and was not edited. It is aligned: both charges are clear; it describes a private lead dashboard and callback requests; it makes no ownership, cancellation, GST or completion-time promise. Its primary CTA is “Message your trade and suburb”. The earlier draft is superseded.
- Use the platform's dedicated website-link field only when applicable and approved. A proposed tagged destination is `https://tradie.simplepage.com.au/?utm_source=gumtree&utm_medium=classified&utm_campaign=tradie_997&utm_content=jack_free`. Do not publish it in a description contrary to the platform's rules. Record enquiries that stay inside Gumtree manually.

## Minimal measurement and follow-up

The page queues events locally in `dataLayer`; this change does not install or publish an analytics container. Before relying on external reports, connect the approved analytics destination and validate its consent/configuration and event counts. Events contain no names, contact details or enquiry text.

| Signal | Meaning | Decision |
|---|---|---|
| cta_clicked / phone_clicked | Intent only, not a lead or a connected phone call | Is the contact path being used? |
| form_viewed / form_started | Exposure and engagement, once per page/form | Where does avoidable friction appear? |
| form_error / form_submitted | Validation or failed attempt, with field name only | Which failure should be fixed? |
| enquiry_saved | Server-confirmed saved request; duplicate retries excluded | Did the website actually capture an enquiry? |
| Manual qualified / quoted / paid stages | Owner-verified commercial progress | Are enquiries becoming profitable paid work? |

`outputs/enquiry-to-paid-job-tracker.csv` is a blank tracker. For each genuine enquiry, record the source/ad version, next action and date. Ask about trade, service area, priority work, existing website and needed scope. Establish timing and capacity. Follow up the agreed next step without inventing a public response-time promise. Record a sent quote separately from cash received. Use the lead reference to avoid counting the same person twice across chat, form and Gumtree.

Review weekly: genuine enquiries, useful conversations, quotes, paying jobs, cash received and lost-job reasons, by source. “Completed” in the lead dashboard does not mean paid. Work backwards from the two-paid-jobs goal using observed enquiry-to-paid conversion once enough evidence exists. Do not assume the current three historical enquiries establish a stable rate.

Media-only acquisition cost is attributable promotion spend divided by new paying customers. With zero customers, report spend and zero acquisitions, not a finite acquisition cost. Assess fees, tools and delivery margin separately. No additional promotion spend is recommended from the current evidence alone.

## Checks and diagnostic limits

23 functional tests pass, including real isolated PostgreSQL writes, migrations, authentication, callback tools, stream failures, minimal phone enquiries, attribution and privacy-safe event deduplication. The preview uses simulated AI and email; no live messages were sent. Previous genuine GPT app verification remains documented in REBUILD_REVIEW.md.

Integrated-browser checks cover desktop and 390px phone layouts, a minimal phone enquiry, invalid phone recovery, storage failure, notification failure, sticky panel exit, preserved draft, reopening, Escape/focus and the staff notification view. Screenshots are in outputs/conversion-*.jpg and outputs/chat-back-mobile.jpg.

Required skill rubric scores are subjective diagnostics, not measured performance: initial form health 78/100 (usable with friction); initial measurement readiness 49/100 (insufficient for acquisition decisions). The changes remediate those findings. No numeric uplift or guaranteed “high-performing” claim is made. Actual measurement readiness remains incomplete until production release, delivery verification and an approved analytics destination are checked.

## Remaining business decisions

Confirm GST treatment; domain registration and professional-email costs; included changes/support and any AI usage limits; cancellation, ownership handover and transfer terms; and who monitors enquiries with a response window they can actually honour. Do not invent these in the page or ad. Confirm that two extra weekly projects fit delivery capacity and margin before increasing acquisition activity.
