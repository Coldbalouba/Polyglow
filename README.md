# TutConnect

A selective, languages-only tutoring marketplace that treats tutors fairly and keeps students' interests first.

- **Fair fees.** Students pay the tutor's listed price, nothing on top. TutConnect keeps **1%** on a tutor's first **5** completed classes and **5%** after that. The fee comes out of the tutor's share and is settled when each class is completed.
- **Selective onboarding.** Before going live, every tutor must:
  1. complete a profile and list the languages they teach (Native, C2 or C1 only),
  2. upload a **resume**,
  3. pass a **skill check**: an auto-scored teaching-methodology quiz (75% pass mark) and a written sample in their teaching language,
  4. submit an **AI-assisted lesson plan** (drafted with Claude, then edited by the tutor).

  An admin then verifies the resume, runs a live skill call, approves the lesson plan, and approves or requests changes.
- **Students** browse and filter vetted tutors by language, price and rating, book open slots, pay, and review completed lessons.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · Prisma 6 · SQLite for local dev (switch to Postgres in one line) · Vitest · Anthropic SDK for lesson-plan drafts.

## Run it locally

Requires Node 20+.

```bash
npm install
cp .env.example .env      # DATABASE_URL defaults to a local SQLite file
npm run setup             # creates the database and loads demo data
npm run dev               # http://localhost:3000
```

Demo accounts (password `password123` for all):

| Email | Role |
|---|---|
| `admin@tutconnect.dev` | Admin: review the pending application from Amélie |
| `student@tutconnect.dev` | Student: browse, book, pay, review |
| `sofia@tutconnect.dev` | Approved Spanish tutor, past the intro period (5%) |
| `kenji@tutconnect.dev` | Approved Japanese tutor, on the 1% intro rate |
| `amelie@tutconnect.dev` | French tutor whose application is waiting for review |

Other scripts: `npm test` (unit tests), `npm run typecheck`, `npm run lint`, `npm run build`.

## Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma connection string. |
| `ANTHROPIC_API_KEY` | Optional. When set, "Generate draft" uses Claude to draft lesson plans. Without it a structured template is used so the flow still works. |
| `ANTHROPIC_MODEL` | Optional model override (default `claude-opus-5-5`). |
| `UPLOAD_DIR` | Where resumes are stored (default `./uploads`, outside the public folder). |
| `STRIPE_SECRET_KEY` | Reserved for the Stripe provider (not implemented yet; payments run in mock mode). |

### Using Postgres

In `prisma/schema.prisma` change `provider = "sqlite"` to `provider = "postgresql"`, set `DATABASE_URL` to your Postgres URL, and run `npm run setup`.

## How it's organised

```
prisma/schema.prisma        data model (users, tutor profiles, applications, slots, bookings, reviews)
prisma/seed.ts              demo data
src/lib/fees.ts             fee model (1% → 5%) + tests
src/lib/skill-check.ts      methodology quiz + scoring + tests
src/lib/application.ts      application completeness and approval rules + tests
src/lib/bookings.ts         book / pay / complete (settles fee) / cancel (refund)
src/lib/payments.ts         payment provider interface; mock provider for now
src/lib/lesson-plan-ai.ts   Claude lesson-plan drafts with a template fallback
src/app/apply               tutor application wizard
src/app/admin               review queue, vetting checklist, approve / request changes
src/app/tutors              browse + tutor profile + booking
src/app/bookings/[id]       booking summary and (mock) checkout
src/app/dashboard           student and tutor dashboards (availability, classes, earnings)
```

## Fee model details

- Rate for a class = 1% if the tutor had completed fewer than 5 classes before it, otherwise 5%.
- At booking we show an estimate. When the tutor marks the class completed, the rate is recalculated from the tutor's completed-class count at that moment and stored on the booking. This means the intro rate covers exactly the first five *completed* classes, even if a tutor has many bookings queued.
- Money is integer cents; the fee rounds half-up to the cent and fee + payout always equals the price.

## Not built yet (next steps)

- Real Stripe Connect: Checkout on booking, Transfers to the tutor's connected account on completion (the hook points are in `src/lib/payments.ts`).
- Video classroom link per booking (e.g. Daily, Whereby, or Zoom API).
- Email notifications (application decisions, booking confirmations, reminders).
- Messaging between students and tutors; trial lessons; packages.
- Password reset and email verification.
- Resume storage in object storage (S3/R2) instead of local disk.
