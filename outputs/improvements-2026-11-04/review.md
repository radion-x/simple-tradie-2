# Tradie acquisition improvements, 4 November 2026

## Observed baseline

- Gumtree listing 1345411166: 25 listing views, zero replies, displayed on page 1 when first inspected. Published 29 October, expires 28 November. Views are not verified unique prospects. Subsequent review visits increased the displayed count to 28.
- Rad confirmed no genuine enquiries by telephone, email, website form or Gumtree.
- The production homepage had no GA4 tag. Existing GA4 property 517169232 had no rows for the inspected periods. This does not establish zero website traffic or a page conversion rate.
- Gumtree emits literal `&amp;` separators in its paid website URL. The attribution adapter previously missed the remaining campaign parameters.

## Interpretation

Observed exposure is limited. There is not enough attributable website traffic evidence to isolate a conversion problem. The changes below are a coordinated improvement, not a controlled A/B test. An enquiry, a qualified opportunity and a paying website job remain separate outcomes.

## Completed changes

- Updated the existing Gumtree ad title, opening, offer and reply prompt. New main artwork keeps Sydney tradies, the price and next step readable. Three genuine portfolio images retained. Existing Free plan and paid website link retained. No boost or additional payment.
- Matching page headline and offer, actual work immediately after the hero, earlier enquiry form, a concrete page-plan conversation and mobile enquiry button. Both $997 and $30/month remain GST inclusive.
- Corrected escaped campaign attribution without changing parameter values.
- Reconnected only the existing GA4 stream with explicit optional consent, safe campaign labels and selected enquiry-step events. No customer details or conversation text in events. No advertising features, Clarity or session recording.
- Disabled automatic enhanced measurement on this one GA4 stream to avoid automatic URL/search/form collection. Original individual preferences preserved in the evidence record.

## Measurement limits and next review

GA4 measures consenting visitors only and cannot reconstruct missing historical data. Staff dashboard entries remain the source for saved requests. Gumtree views and replies should be compared with qualified enquiries and attributable paying customers. Page views, form starts and saved requests are not sales.

If views remain low, changing page copy alone cannot solve acquisition volume. Assess distribution separately before buying a boost. Any spending recommendation should work back from desired paying website jobs and measured acquisition cost, with an agreed spend ceiling.

## Validation

12 focused analytics and attribution tests passed, plus application syntax checks and diff whitespace checks. Desktop and 390 px mobile layouts reviewed. Main CTA, required form validation and assistant/sticky-button interaction reviewed locally. Local review forms cannot send enquiries. Production verification recorded after deployment.
