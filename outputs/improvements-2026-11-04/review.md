# Tradie acquisition improvements, 4 November 2026

## Observed baseline

- Gumtree listing 1345411166: 25 listing views, zero replies, displayed on page 1 when first inspected. Published 29 October, expires 28 November. Views are not verified unique prospects. Subsequent review visits increased the displayed count to 28.
- Rad confirmed no genuine enquiries by telephone, email, website form or Gumtree.
- The production homepage had no GA4 tag. Existing GA4 property 517169232 had no rows for the inspected periods. This does not establish zero website traffic or a page conversion rate.
- Gumtree emits literal `&amp;` separators in its paid website URL. The October 30 production update already recovers those parameters. That existing repair and its latest-campaign handling were preserved after merging the newer main branch.

## Interpretation

Observed exposure is limited. There is not enough attributable website traffic evidence to isolate a conversion problem. The changes below are a coordinated improvement, not a controlled A/B test. An enquiry, a qualified opportunity and a paying website job remain separate outcomes.

## Completed changes

- Updated the existing Gumtree ad title, opening, offer and reply prompt. New main artwork keeps Sydney tradies, the price and next step readable. Three genuine portfolio images retained. Existing Free plan and paid website link retained. No boost or additional payment.
- Matching page headline and offer, actual work immediately after the hero, earlier enquiry form, a concrete page-plan conversation and mobile enquiry button. Both $997 and $30/month remain GST inclusive.
- Preserved the existing escaped-campaign attribution repair and latest-campaign handling, with additional regression tests.
- Connected a dedicated replacement stream in the existing Tradie GA4 property with explicit optional consent, safe campaign labels and selected enquiry-step events. No customer details or conversation text in events. No advertising features, Clarity or session recording.
- Disabled automatic enhanced measurement on the old Tradie stream and the dedicated replacement to avoid automatic URL/search/form collection. The old stream and history are preserved. Its former individual preferences remain in the evidence record. The old destination ID returned HTTP 404 for the Google script and was found to belong to a shared tag, so that shared tag was not activated or changed.

## Measurement limits and next review

GA4 measures consenting visitors only and cannot reconstruct missing historical data. Staff dashboard entries remain the source for saved requests. Gumtree views and replies should be compared with qualified enquiries and attributable paying customers. Page views, form starts and saved requests are not sales.

If views remain low, changing page copy alone cannot solve acquisition volume. Assess distribution separately before buying a boost. Any spending recommendation should work back from desired paying website jobs and measured acquisition cost, with an agreed spend ceiling.

## Validation

14 focused analytics and attribution tests passed, plus application syntax checks and diff whitespace checks. Desktop and 390 px mobile layouts reviewed. Main CTA, required form validation and assistant/sticky-button interaction reviewed locally. Local review forms cannot send enquiries. Production verification recorded after deployment.

## Publication

- Gumtree confirmed the existing ad was updated successfully, with four images and the Free plan retained. The website button was checked through Gumtree and loaded the new page with all four campaign labels recovered.
- Main page revision c8c65e92d84c862bb97317b6c821b97eab72312c deployed successfully at 02:25:22 UTC. The final measurement revision and receipt check are recorded below.
- Public desktop/mobile screenshots and the published ad gallery are saved alongside this record.
