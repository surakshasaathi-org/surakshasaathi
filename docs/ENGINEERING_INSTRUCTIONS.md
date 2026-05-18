# SurakshaSaathi_Claude_Code_Instructions.docx

_Text extract for readable reference. Authoritative source is the .docx in this folder._

---

SurakshaSaathi

surakshasaathi.com

Claude Code — Engineering Instructions

Standing Instructions for AI-Assisted Development

Read before every session. Apply to every task.

Version 1.0 -- April 2026

1. Engineering Philosophy

SurakshaSaathi is a long-horizon platform, not a hackathon project. Every architectural decision must be made with the assumption that:

The product will serve millions of users across India over a 5+ year horizon

New insurance lines (crop, travel, cyber, pet) will be added over time

New geographies (South Asia, NRI markets) may be added in future

New product lines and ideas will be layered onto the platform as the business grows

Some features will always be free; others will be paywalled or subscription-gated

Vernacular language support (12 Indian languages) is a first-class requirement, not an afterthought

✔  Build for extensibility from Day 1. A shortcut taken today is a migration cost at 100,000 users.

When in doubt between a faster approach and a more extensible one: choose extensibility if the refactoring cost later exceeds 2x the upfront investment. Always flag the trade-off explicitly rather than making the call silently.

2. Before Starting Any Feature -- Mandatory Steps

2.1 Architecture Review First

Before writing a single line of code for any new feature, present a brief architecture proposal that covers:

What data models and schema changes are needed

How this feature hooks into existing systems (auth, payments, notifications, language layer)

Whether this feature is free, freemium, or paid -- and how that enforcement works

Whether this feature requires login or can be accessed anonymously

Which languages this feature needs to support at launch vs. in a later phase

What the API surface looks like if this becomes a B2B or white-label product in the future

⚠  Do not begin implementation until the architecture has been reviewed and approved. Asking first saves days of rework.

2.2 Clarify All Assumptions Explicitly

If anything in the requirements is ambiguous, stop and ask before building. Specifically call out:

Assumed user persona -- who is using this feature, what device, what literacy level

Assumed data sources -- where does scheme data, policy data, or hospital data come from

Assumed monetization -- is this feature free forever, freemium, or paid from Day 1

Assumed language scope -- which languages at launch

Assumed auth requirements -- login required? what level of identity verification

❌  Never silently assume. An unasked assumption that is wrong wastes more time than the question would have taken.

2.3 Document Decisions as You Go

For every significant architectural decision, add a brief ADR (Architecture Decision Record) comment in the codebase explaining: what decision was made, why this approach was chosen, what the trade-offs are, and what would need to change if requirements shift.

3. Scalability Requirements

3.1 Design for Scale from Day 1

Database

Use PostgreSQL. Design schemas with proper indexing from the start. Avoid patterns that require full-table scans at 1M+ rows.

API design

RESTful or GraphQL -- decide upfront and be consistent. All APIs must be versioned (e.g. /api/v1/). Breaking changes require a new version.

Caching

Redis for sessions, rate limiting, and frequently accessed data (scheme eligibility rules, hospital networks). Never cache user-specific financial data without a defined expiry.

File storage

All policy documents, letters, and PDFs go to S3-compatible object storage (AWS S3 or Cloudflare R2). Never store binary files in the database.

Background jobs

Use a proper queue (BullMQ or similar) for: document OCR, letter generation, ombudsman deadline tracking, WhatsApp message sending. Never block an HTTP response on a slow operation.

Search

Hospital network, scheme eligibility, and policy search must use indexed search -- not SQL LIKE queries. Elasticsearch or Typesense for full-text.

Rate limiting

Apply rate limits on all public endpoints. Authenticated users get higher limits. Free tier gets lower limits than paid tier.

3.2 Multi-Tenancy Ready

The platform must be architected for multi-tenancy from the start. Future use cases include B2B white-label for brokers, NGO operator dashboards, corporate HR tools, and state government partnerships.

✔  Every data model must have a tenant_id or organization_id field, even if only one tenant exists on Day 1. Adding this later is a painful and risky migration.

3.3 Insurance Line Extensibility

The schema and product architecture must accommodate insurance lines beyond the initial scope. Current lines: health, life. Anticipated additions: motor, crop, cyber, travel, property, pet. New lines must be addable without code changes.

⚠  Do not hardcode insurance_type as an enum with fixed values. Use a database-driven configuration table so new lines can be added by inserting a record, not by deploying code.

4. Monetization Architecture

SurakshaSaathi has a mixed monetization model. Some features are always free (social good and acquisition), some require login, some are subscription-gated, and some use a success-fee model. All must coexist cleanly.

4.1 Feature Access Tiers

Tier

Login Required

Examples

Revenue Model

Anonymous Free

No

Govt scheme eligibility check, insurance literacy content

Acquisition -- leads to upsell or subscription

Registered Free

Yes (phone OTP)

Basic Policy Health Score, dashboard, renewal reminders

Data for personalisation; upgrade prompts

Freemium (Paid Feature)

Yes + payment

Full claim readiness check, document kit, escalation letter drafting

One-time or subscription fee

Success Fee

Yes + case filing

Claim recovery, mis-selling recovery, unclaimed amount recovery

10-15% of amount recovered, collected after recovery

Subscription

Yes + recurring billing

Family Insurance OS premium, MSME annual review, Senior protection plan

Monthly or annual recurring via Razorpay Subscriptions

B2B SaaS

Yes + org account

NGO dashboard, HR tool, CSC operator portal, broker white-label

Per-seat or per-employee/year SaaS contract

⚠  The government scheme eligibility check must ALWAYS remain free and anonymous. This is a non-negotiable product principle. Never gate it behind login or payment.

✔  Build the access control layer as a standalone middleware. Feature flags, tier checks, and payment verification must never be scattered across business logic components.

4.2 Payment Infrastructure

Use Razorpay as the primary payment gateway -- UPI, cards, net banking, wallets

Store no raw card or payment data -- use Razorpay tokens only

Subscription billing via Razorpay Subscriptions, not manually managed renewals

Success-fee cases: payment collected only after confirmed recovery -- use escrow flow or manual trigger with audit log

All payment events must be logged with full audit trail: who paid, when, for what, which tier was unlocked

4.3 Feature Flags

All paid and freemium features must be controlled via feature flags, not code branches. This enables turning features on/off per user or tier without deployment, A/B testing different pricing, and beta access for specific users.

✔  Use a feature flag system (LaunchDarkly, Flagsmith, or a database-backed implementation). Never scatter if (user.isPremium) checks across components.

5. Authentication and Login Architecture

5.1 Auth Levels

Anonymous

No account. Access to free, non-personalised features only. No data stored beyond session analytics.

Phone OTP

Lightweight signup. Phone + OTP. Required for saving progress, accessing personalised features, filing a case. Primary flow for vernacular and low-literacy users.

Email + Password

Full account. Required for subscription management, document vault, policy portfolio. Supports password reset.

Social Login

Google or Apple as an option for urban tech-savvy users. Not the primary flow -- vernacular users do not use social login.

Aadhaar eKYC

Required for high-value case recovery above 50,000 rupees, broker-linked policy access, B2B org admin. UIDAI-compliant eKYC flow only.

B2B Org Account

Organisation login with role-based access: admin, advisor, viewer. SSO support for enterprise HR tools.

✔  Phone OTP is the primary signup flow for B2C users. Most target demographic does not have email as a primary identifier.

⚠  Never require Aadhaar for features that do not legally require identity verification. Aadhaar eKYC is only for high-stakes financial actions.

5.2 Session Management

JWT for API authentication. Short expiry (15 minutes) with refresh tokens (7 days).

Refresh token rotation: every refresh issues a new token and invalidates the old one.

Device tracking: log device fingerprint, IP, and user agent for all auth events.

Logout everywhere: users can invalidate all sessions from account settings.

5.3 Data Privacy -- DPDP Act 2023 Compliance

Collect only what is needed. Every data field must have a documented purpose.

Explicit consent at point of collection. Consent must be granular, not a single all-or-nothing checkbox.

Right to access: users can download all their data within 72 hours of request.

Right to erasure: users can delete their account and all associated data.

Data retention policy: define per data type. Policy documents: 7 years. Session logs: 90 days.

Never sell or share user data with third parties without explicit opt-in consent.

6. Vernacular and Language Support

Vernacular support is a first-class product requirement, not a translation afterthought. A significant portion of SurakshaSaathi users will not be comfortable in English. The platform must be genuinely usable in Indian regional languages -- not just technically translated.

6.1 Language Scope and Phasing

Language

Phase

User Base

Notes

Hindi

Phase 1 (Launch)

500M+ speakers

Primary vernacular. All features must be Hindi-ready at launch.

Kannada

Phase 1 (Launch)

Karnataka focus

Bengaluru-anchored launch makes Kannada critical from Day 1.

Tamil

Phase 1

Tamil Nadu

Strong state scheme ecosystem (CMCHIS). Large PM-JAY base.

Telugu

Phase 1

AP + Telangana

Large Aarogyasri beneficiary base.

Bengali, Marathi, Gujarati, Malayalam

Phase 2

WB, MH, GJ, KL

Add with state-level scheme expansions.

Punjabi, Odia, Assamese, Urdu

Phase 3

Regional expansion

Add with geographic expansion beyond initial states.

6.2 Implementation Requirements

All user-facing strings must be externalised into i18n resource files from Day 1. No hardcoded English strings in components.

Use a standard i18n library -- react-i18next for React, i18n-js for React Native. Namespace strings by feature area.

Language selection: detect from browser or device locale. Allow manual override. Store preference in user profile.

RTL support: Urdu requires right-to-left layout. Build RTL-compatible CSS from the start.

Font support: ensure all Indian language scripts render correctly. Use Google Noto fonts as the fallback for all scripts.

Insurance terminology: do NOT use machine translation for insurance terms. Maintain a curated glossary with human-reviewed translations per language.

Voice support: text-to-speech and voice input (Web Speech API or Sarvam AI for Indian languages) for low-literacy users. Critical for government scheme navigator.

✔  Build a language completeness checker that flags any feature with missing translations before it can be deployed to production.

⚠  Google Translate is not acceptable for insurance terminology. A mistranslated exclusion clause can cause real financial harm. All insurance content translations must be human-reviewed before going live.

7. Landing Page Requirements

7.1 Core Principles

The landing page must do one job: make the visitor immediately understand what SurakshaSaathi is, why it matters to them specifically, and what to do next. It is not a feature list. It is not a company brochure. It is a conversion surface.

✔  A visitor must understand the value proposition within 5 seconds, without scrolling. Test this with real users.

7.2 Above the Fold -- Non-Negotiable Elements

Primary headline: addresses the core pain, not the solution. Lead with the user problem, not the product features.

Sub-headline: what SurakshaSaathi specifically does -- in one clear sentence. Not a bullet list of features.

Single primary CTA: one action above the fold, not five. Decide: Check Your Eligibility, Analyse My Policy, or Talk to an Advisor. One.

Language toggle: prominent and immediately visible. Not buried in a menu. Supports Hindi and regional languages from launch.

Trust signal: one powerful number or testimonial above the fold. Claims recovered, families served, or a specific real story.

7.3 Page Structure

Section 1 -- Hero

Pain-led headline + sub-headline + single CTA + language toggle + one trust signal

Section 2 -- The Problem

Data-backed description of what is broken about Indian insurance. 3 key statistics. No fluff or vague claims.

Section 3 -- What We Do

Brief, honest description of 3-4 main product clusters. Not all 8 ideas. Group into: Claims Recovery, Policy Advisory, Government Schemes, Protection for Seniors.

Section 4 -- How It Works

3-step visual: 1) Tell us your situation, 2) Get your personalised report, 3) We help you act on it.

Section 5 -- Who We Help

4 user personas with specific scenarios: senior citizen, urban family, rural PM-JAY beneficiary, MSME owner.

Section 6 -- Trust

Testimonials (real, specific, named), any media coverage, IRDAI alignment statement.

Section 7 -- Pricing Clarity

Explicit and honest: what is always free, what costs money, why. No hidden charges, no asterisks.

Section 8 -- FAQs

Answer the 5 real objections: Is this legitimate? Is my data safe? Am I eligible? Is it really free? How long does it take?

Footer

Company info, IRDAI registration number, DPDP compliance statement, language links, social channels, grievance contact.

⚠  Do not use generic stock photos of happy families on the landing page. Use specific data, real language, and real pain. Generic insurance portal aesthetics kill trust with the target demographic.

7.4 Extensibility for Future Products

The product section must use a modular card-based layout. Adding a new product line means adding a card, not redesigning the page.

Each product card links to a dedicated landing page for that product (/claims-recovery, /govt-schemes, /msme, etc.).

When a new geography launches, the language toggle expands. When a new insurance line launches, a new product card appears. Both must require zero engineering changes -- pure configuration.

8. Git, Deployment, and Release Protocol

8.1 Git Rules -- Non-Negotiable

❌  NEVER push to the main or master branch directly. NEVER run git push without explicit confirmation from the product owner. This rule has no exceptions.

All work happens in feature branches. Naming convention: feature/[idea-number]-[short-description]. Example: feature/1-claims-intake-whatsapp

Before ANY git push: state exactly what branch, what commits, what changed, and ask for explicit approval. Wait for confirmation.

Pull requests must include: what was built, what was tested, what is NOT yet tested, and any known issues or limitations.

Never force-push to shared branches. Never rewrite history on branches others may have pulled.

Commit messages must be meaningful. Use standard prefixes: feat:, fix:, refactor:, docs:, test:. Not "fix" or "update" alone.

✔  The rule is: ask before push, always. Even if the change seems trivial. Even if you are certain it is correct.

8.2 Branch Strategy

main

Production only. Protected. Requires PR and approval. Deploys automatically to production on merge.

staging

Pre-production. Stable and tested. Deploys automatically to staging environment. Never push untested code here.

feature/*

All development work. Merged to staging via PR after review and testing.

hotfix/*

Emergency production fixes only. Branch from main. Merge to both main and staging. Requires approval even for urgent fixes.

8.3 Environment Rules

Local

Developer machine. Uses .env.local. Never commits secrets. Never connects to production database.

Staging

Mirrors production config. Used for QA and UAT. Separate database. Razorpay test keys only.

Production

Real users, real data, real money. Deploy only after staging sign-off. No direct access for debugging.

❌  NEVER use production API keys, production database credentials, or real user data in local or staging environments. Not even briefly.

9. Testing Requirements

Every feature must be thoroughly tested before it is considered done. Written code is not done. A quick click-through is not done. A feature is done when it is tested against the checklist below.

9.1 Feature Testing Checklist

Unit tests: core business logic (eligibility calculation, rejection classification, fee computation) must have unit tests covering happy path and edge cases

Integration tests: API endpoints tested with real database interactions, not mocks only

Happy path: the primary user flow works end-to-end without errors

Edge cases: empty states, invalid input, network timeout, partial or missing data

Error states: every failure must show a useful user-facing message, not a raw error or blank screen

Mobile: test on actual mobile viewport at 375px width minimum. Do not test only on desktop.

Language: test the feature in at least Hindi in addition to English. Verify no layout breaks with longer vernacular strings.

Accessibility: keyboard navigation and screen reader compatibility for all interactive elements

Payment flows: test all paid features with Razorpay test mode. Verify webhook handling for success, failure, and cancellation.

Auth boundaries: verify unauthenticated users cannot access auth-required features, and free-tier users cannot access paid features

✔  A feature is DONE when it is tested. Not when the code is written. The testing is part of the work, not a separate phase.

9.2 Performance Standards

Lighthouse score above 80 on mobile for all public pages

All APIs must respond within 500ms for P95 of requests, excluding background job triggers

Document processing (OCR, PDF generation) must be background jobs -- never blocking the UI

Run EXPLAIN ANALYZE on any new query touching tables expected to exceed 100,000 rows

9.3 Security Testing

Input sanitisation: test all user inputs for SQL injection and XSS vulnerabilities

File upload: validate file type, size, and content. Reject malicious uploads.

API auth: verify all endpoints check authentication and authorisation. Test with expired tokens, wrong-user tokens, and missing tokens.

Secrets scan: run a secrets scanner before every PR. No API keys or credentials in the codebase.

10. Future-Proofing Checklist

Before closing any major feature, run through this checklist. These questions catch architectural decisions that will be expensive to undo later.

10.1 New Product Lines and Insurance Types

Can a new insurance line be added by inserting a database record, with no code change?

Are insurance-type-specific business rules stored as configuration, not hardcoded in logic?

Does the claims flow work generically across insurance types, or is it specific to health?

10.2 New Geographies

Are currency, date format, and number formatting locale-aware? Nothing hardcoded for India or INR?

Are regulatory references (IRDAI, Ombudsman) abstracted so a different regulator can be added for another country?

Is the hospital or provider network data model flexible enough for providers in another country?

10.3 Monetization Changes

If a currently-free feature becomes paid, is there a clean way to gate it without a major refactor?

If a currently-paid feature becomes free, can it be ungated in one configuration change?

Are all monetization checks enforced server-side, not just client-side? Client-side checks can be bypassed.

10.4 Scale

If traffic spikes 10x overnight, what breaks first? Is that risk documented and addressed?

Are background jobs throttled to prevent overloading downstream services such as government APIs or insurer endpoints?

Is the database connection pooled correctly for concurrent load?

10.5 Team Growth

Is the codebase documented well enough that a new engineer can onboard in one day?

Are environment setup instructions in a README that is actually up to date?

Is there a consistent code style enforced by a linter such as ESLint and Prettier?

The Standard

Build it like millions of families depend on it.

Because they will.
