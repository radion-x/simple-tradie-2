# Gumtree measurement, 11 November 2026

Owner: Simple Page team (Radion). No added ad spend or paid measurement service.
Report: https://tradie.simplepage.com.au/admin/performance.html

## Decision and readiness

Decision: does the existing Gumtree listing produce genuine enquiries and new paying website customers, and is the observed acquisition cost commercially worthwhile?

Initial diagnostic: 61/100, Unreliable. Decision alignment 23/25, event model 14/20, accuracy 9/20, conversion definitions 5/15, attribution 4/10, governance 6/10. Source context existed, but there was no payment outcome, no unified visitor/enquiry report, and only consented Google traffic. GA4's existing property uses Australia/Perth dates. Its 4–11 November dedicated-stream report contained a single direct session consistent with the previously documented owner test, not evidence of customer demand.

Implemented design: 84/100, Usable with Gaps. Decision 25, events 18, accuracy 15, conversion definitions 14, attribution 6, governance 6. The remaining limits are consent coverage, tab sessions rather than unique people, contact-based prospect grouping, manual payment verification, and no cross-device identity. The score is a diagnostic judgement, not a performance benchmark.

## Tracking plan

| Record | Trigger | Context | Counting | Use |
| --- | --- | --- | --- | --- |
| Measured visit | Public landing page with analytics allowed | Random tab-session reference, recognised source, server time | Once per reference; reset after 30 minutes inactive or source changes | Count measured arrivals |
| Enquiry | Successful server save | Original campaign, latest tagged source, allowed visit reference if available | Retry-safe event ID; prospects grouped by email, otherwise phone | Count enquiring prospects |
| Transcript | Explicit transcript request | Same saved source | Not an enquiry until reviewed into a sales stage | Avoid inflated leads |
| Qualified / quoted | Staff update | Enquiry record and audited sales stage | Current stage on each record | Follow-up prioritisation |
| Paying customer | Staff confirms agreed scope and cleared first payment | Stable customer reference, payment reference, date, actual AUD amount | Unique normalised customer reference across paid records | Actual acquired customers |
| Phone / Gumtree message | Staff adds actual conversation | First enquiry date and known source | Retry-safe, same prospect rules | Capture outcomes outside the site |
| Exclusion | Staff records reason | Test, spam or duplicate of SP-reference | Omitted from enquiry and payment totals | Keep counts honest |

Original source stays intact. Latest tagged source is stored separately and used in acquisition reporting. A customer-confirmed override requires a note and is labelled separately. Returning direct traffic does not erase a previously tagged source in the same tab. The existing source-only Gumtree link gets the known classified medium in the GA4 adapter; private reporting recognises its Gumtree source directly. Unknown campaign values never go to Google. See Google's official campaign configuration reference: https://developers.google.com/analytics/devguides/collection/ga4/reference/config

## Report interpretation

The enquiry period uses Australia/Sydney dates. Paying customers in the main card belong to that enquiry cohort, including payments recorded later. A separate payment-date total reports first-payment cash received during the selected period. It is not full project revenue. The matched visit rate divides visits with a saved enquiry by measured visits that started in the range. Do not divide all enquiries by consented visits. Old visits cannot be backfilled. Visit records expire after 13 months; do not use older ranges to assess visitor conversion.

The first-payment reference is a staff record of money already received. The report does not charge customers, process money or read a bank account. Review duplicate contacts before counting. Use one stable business/customer reference, and exclude repeat acquisition records for existing customers. Enquiry completion in the original dashboard is separate from payment.

## Working routine

1. Review new records and exclude tests, spam and duplicates, with a reason.
2. Update qualification, quote progress and the next follow-up in notes.
3. Add genuine Gumtree messages and phone enquiries if they do not already have a website record. Use the original enquiry date.
4. After the agreed deposit or first full payment clears, select First payment received and enter its actual date, amount and references. Confirm accepted scope and cleared payment.
5. Compare the same enquiry cohort as it matures. Record actual attributable ad spend from receipts separately. Media-only cost per acquired paying customer = attributable ad spend / new paying customers. With zero customers, a finite acquisition cost is not established. All-in cost adds only the explicitly included fees, tools and sales labour. No new spend is authorised or needed for this implementation.

## Validation and governance

Consent defaults off. Decline and withdrawal stop private measurement as well as Google events. Staff with an active dashboard session are excluded from private visit counts. Analytics failures do not block forms. Private visit records have no IP, user-agent, fingerprint, form answers or chat text. Payment and sales history remain behind existing staff authentication. Public endpoints accept only allowlisted source labels and a random reference; authenticated writes require the site origin and JSON. Payment updates are audited and duplicate customers rejected.

Tests cover clean/legacy migrations, record preservation, form/callback/transcript saves, safe source capture, consent and withdrawal, retry deduplication, staff exclusion, API authentication and origin, invalid payments, repeated updates, customer deduplication, sales history, transcript exclusion, cohort vs payment dates, and manual-enquiry saves without email. Browser review includes a controlled local payment update. Production migration is a reviewed one-time pre-deployment hook with a transaction, lock timeout, target guard and enquiry fingerprint check. It is removed after publication. Coolify's supported hook field is documented at https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid
