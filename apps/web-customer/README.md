# @suraksha/web-customer

The public-facing consumer web app: `surakshasaathi.com`.

## Run locally

```bash
pnpm install
cp .env.example .env.local    # fill in Supabase + Anthropic keys
pnpm --filter @suraksha/db migrate
pnpm --filter @suraksha/db seed
pnpm dev
```

Then open `http://localhost:3000`. You'll land on the English hero; `/hi` and `/kn` serve Hindi and Kannada.

## Architecture notes

- **Module grid is DB-driven** — reads `product_module` rows via `@/lib/modules`. To add or edit a module, insert/update a row and the landing page updates on the next revalidate (5 min) or admin-triggered cache bust. See ADR-0003.
- **i18n** uses `next-intl` with locales under `@suraksha/i18n/locales/`. New locales: add to `ACTIVE_LOCALES` + copy `locales/en/*.json` to a new folder and translate.
- **Auth** is Supabase phone OTP. The `/sign-in` page posts to a route handler (to be implemented) that calls `supabase.auth.signInWithOtp`.
- **Middleware** handles locale detection + URL prefix. See `src/middleware.ts`.
