# Simple Page Rebrand - Implementation Notes

## Overview
This document outlines the changes made to pivot the business identity from "Websited" to "Simple Page". The goal was to shift targeting from "General Corporate" to "Budget-Conscious Small Business & Tradies" with a focus on speed, transparency, and affordability.

## Core Changes

### 1. Brand Identity
- **Name**: "Simple Page" (or "Simple Page by Websited" for continuity).
- **Tone**: Direct, punchy, jargon-free.
- **Target Audience**: Small businesses, tradies, startups.

### 2. Homepage (`public/index.html`)
The homepage has been completely refactored to serve as the main landing page for the "Simple Page" offer.

- **Hero Section**:
  - Headline: "Affordable Websites for Sydney Small Businesses".
  - Subhead: "Professional, mobile-friendly websites starting from just $600..."
  - CTA: "See Pricing" (Linked to #pricing).

- **New "The 'Simple' Difference" Section**:
  - Replaced the generic "Value Proposition" section.
  - 3 Pillars: Rapid Turnaround, Transparent Pricing, Mobile Perfect.

- **Tech Stack Section**:
  - Replaced the "Process" section.
  - Highlighted "The Right Tech for Your Budget" (WordPress, Shopify, Next.js/React).

- **Pricing Section (Critical Update)**:
  - Replaced generic packages with a specific 3-Tier Grid.
  - **Tier 1: The 'One-Pager' ($600 - $999)**: For tradies, cafes.
  - **Tier 2: Business Essentials ($1,800 - $2,800)**: For lawyers, clinics.
  - **Tier 3: E-Commerce Startup ($2,500 - $4,000)**: For online stores.

- **FAQ Section**:
  - Rewritten to handle objections (Why cheaper? Updates? Timeline?).

- **Footer & CTA**:
  - Updated to "Ready to grow?" and "Book a Free 15-Min Chat".
  - Canonical URL updated to root (`https://websited.au/`).

### 3. Offers Page (`public/offers/index.html`)
- Updated the "Simple Websites" card to reflect the new starting price of **$600** (was $1,495).
- Updated description to align with the new value proposition.

### 4. Simple Websites Landing Page (`public/offers/simple-websites/index.html`)
- This page was refactored first and then promoted to the homepage.
- It remains available at `/offers/simple-websites/` but the main traffic should be directed to the homepage.

## Technical Notes
- **Inline CSS**: Specific styles for the new grid layouts (`simple-difference-grid`, `pricing-grid-3`, etc.) were added to the `<head>` of the HTML files to ensure immediate rendering without modifying the global `styles.css` (reducing regression risk).
- **Navigation**:
  - Homepage Nav Link is now active by default on `public/index.html`.
  - "Simple Websites" in the Offers dropdown points to `/` (Homepage).

## Next Steps
- Review `styles.css` to potentially move inline styles to the main stylesheet for cleaner HTML.
- Update other offer pages if they need to align with the "Simple Page" branding.
- Verify all links and forms are functioning correctly in the production environment.
