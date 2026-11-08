# Polyglow

A selective, languages-only tutoring marketplace that treats tutors fairly and keeps students' interests first.

- **Fair fees.** Students pay the tutor's listed price, nothing on top. Polyglow keeps **1%** on a tutor's first **5** completed classes and **5%** after that. The fee comes out of the tutor's share and is settled when each class is completed.
- **Selective onboarding.** Before going live, every tutor must:
  1. complete a profile and list the languages they teach (Native, C2 or C1 only),
  2. upload a **resume**,
  3. pass a **skill check**: an auto-scored teaching-methodology quiz (75% pass mark) and a written sample in their teaching language,
  4. submit an **AI-assisted lesson plan** (drafted with Claude, then edited by the tutor).

  An admin then verifies the resume, runs a live skill call, approves the lesson plan, and approves or requests changes.
- **Students** browse and filter vetted tutors by language, price and rating, book open slots, pay, and review completed lessons.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma 6 + PostgreSQL · Stripe Connect · email over SMTP or Resend · Vitest · Docker Compose (app, Postgres, Caddy HTTPS, hourly jobs, daily backups) · optional Anthropic SDK for lesson-plan drafts.

**To run it on your own server (about $5.50/month), follow [HOSTING.md](HOSTING.md).**

## Run it locally

Requires Node 20+ and a Postgres database (local install, Docker, or a hosted Postgres).

```bash
npm install
cp .env.example .env      # set DATABASE_URL and DIRECT_URL; leave Stripe/Resend empty for demo mode
npm run setup             # creates tables and loads demo data
npm run dev               # http://localhost:3000
```

Demo accounts (password `password123` for all):

| Email | Role |
|---|---|
| `admin@polyglow.dev` | Admin: review applications and disputes |
| `student@polyglow.dev` | Student, with one finished lesson waiting to be confirmed |
| `sofia@polyglow.dev` | Approved Spanish tutor, past the intro period (5%) |
| `kenji@polyglow.dev` | Approved Japanese tutor on the 1% intro rate, $10 trial |
| `amelie@polyglow.dev` | French tutor whose application is waiting for review |

Without Stripe keys the site runs in **demo mode** (a "Pay (demo)" button, no real money). Without a Resend key, emails print to the server log. All settings are listed in `.env.example`.

Scripts: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

## Policies (and why)

Each is a direct answer to common complaints about big tutoring marketplaces. Rules live in `src/lib/policy.ts` with tests.

| Problem elsewhere | Polyglow |
|---|---|
| 18–33% commission | 1% on a tutor's first 5 completed lessons, then 5% |
| Platform keeps 100% of trial lessons | Tutor is paid for trials and sets the trial price (or makes it free) |
| Subscriptions that auto-renew, lessons that expire | Pay per lesson; nothing renews or expires |
| Processing fees added for students | Students pay the listed price, nothing on top |
| Refunds as credits, slow and discretionary | Automatic refund to the card for cancellations 12h+ ahead or any tutor cancellation |
| No-shows with slow support | "Report a problem" up to 24h after the lesson; admin queue with a 48h target |
| Tutors chasing lesson confirmations | Lessons auto-confirm 24h after they end |
| Withdrawal fees and platform holding tutor money | Paid straight into the tutor's own Stripe account |
| Opaque, pay-to-play ranking | Public formula: Bayesian rating, new-tutor boost, small penalty for tutor cancellations, no paid placement |
| Locked-in classroom | Tutor's own Zoom/Meet link or a free Jitsi room |

## How it's organised

```
prisma/schema.prisma        data model (users, tutor profiles, applications, slots, bookings, reviews)
prisma/seed.ts              demo data
src/lib/fees.ts             fee model (1% → 5%) + tests
src/lib/skill-check.ts      methodology quiz + scoring + tests
src/lib/application.ts      application completeness and approval rules + tests
src/lib/policy.ts           cancellation, refund, dispute, auto-complete, trial pricing, ranking rules + tests
src/lib/bookings.ts         book → Stripe Checkout → confirm, cancel/refund, disputes, hourly jobs
src/lib/stripe.ts           Stripe Connect (accounts, onboarding, direct charges, refunds, fee settlement)
src/lib/email.ts            email over SMTP or Resend (logs to console when not configured)
src/app/api/stripe/webhook  Stripe Connect webhook
src/app/api/cron            hourly housekeeping, called by the jobs container (deploy/jobs.sh)
deploy/                     server setup, Caddyfile, jobs and update scripts; see HOSTING.md
src/lib/lesson-plan-ai.ts   Claude lesson-plan drafts with a template fallback
src/app/apply               tutor application wizard
src/app/admin               application review, vetting checklist, disputes
src/app/tutors              browse + tutor profile + booking
src/app/bookings/[id]       booking page: payment, join link, messages, cancel, confirm, report a problem
src/app/dashboard           student and tutor dashboards (availability, classes, earnings)
```

## Fee model details

- Rate for a class = 1% if the tutor had fewer than 5 completed classes before it, otherwise 5%.
- At payment, the fee is set from the class's position among the tutor's paid classes. When the class completes, the fee is recalculated from completed classes; if it's lower, the difference is refunded to the tutor through Stripe's application-fee refund. Tutors are never charged more than the estimate.
- Money is integer cents; fee + tutor share always equals the price.

## Not built yet

- Built-in video classroom (we link out to Jitsi/Zoom/Meet).
- Currencies other than USD; payouts for tutors in countries Stripe doesn't support.
- Rescheduling (cancel + rebook works today), lesson packages, mobile apps.
- Login rate limiting beyond a small delay, and email verification.
