# Launching TutConnect for (almost) $0

Everything below runs on free tiers. The **only thing worth paying for is a domain** (about $5–11 per year), and even that is optional on day one.

| Piece | Service | Cost | Free-tier limits that matter |
|---|---|---|---|
| Hosting + hourly jobs | Netlify (Starter plan) | $0 | 300 credits/month. A deploy costs 15 credits, so about 20 deploys a month plus traffic. If credits run out the site pauses until next month; you are never charged on the free plan. Commercial use is allowed. |
| Database | Neon Postgres (Free) | $0 | 0.5 GB storage, plenty for thousands of users. Resumes are stored here (3 MB max each). |
| Payments | Stripe Connect | $0/month | No monthly fee. Stripe takes its normal card fee (about 2.9% + 30¢ in the US) per payment, paid from the tutor's share. With the setup used here Stripe charges the platform no Connect fees. |
| Email | Resend (Free) | $0 | 3,000 emails/month, 100/day, 1 domain. Needs a domain you own to email users. |
| Video lessons | Jitsi Meet or the tutor's own Zoom/Meet link | $0 | |
| AI lesson-plan drafts | Claude API (optional) | Pay per use | Leave `ANTHROPIC_API_KEY` empty and tutors get a built-in template instead. |
| Domain | Cloudflare Registrar or Porkbun | ~$5–11/year | `.com` is about $10.46–11.17/yr at Cloudflare (at cost). Cheaper options: `.uk` about $5.30/yr. You can start on the free `yoursite.netlify.app` address. |

**Total: $0 to start, about $5–11 per year once you add a domain.** Nothing here needs a monthly subscription.

---

## What you have to do yourself (about 1 hour)

Accounts must be opened by you because they need your identity, email and (for Stripe) bank details.

### 1. GitHub (free)
1. Create an empty **private** repository named `tutconnect` at https://github.com/new (no README).
2. Tell Claude in the project thread; it will push the code there.

### 2. Neon database (free)
1. Sign up at https://neon.tech and create a project (pick the region closest to your users).
2. On the dashboard click **Connect**. Copy two strings:
   - the **pooled** connection string → `DATABASE_URL`
   - the **direct** one (toggle "Connection pooling" off) → `DIRECT_URL`

### 3. Stripe (free, test mode first)
1. Sign up at https://dashboard.stripe.com/register. Stay in **Test mode** (toggle top right).
2. Go to **Connect** → **Get started** → choose **Platform or marketplace**. Finish the short setup.
3. **Developers → API keys**: copy the **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`.
4. After your site is deployed (step 5), go to **Developers → Webhooks → Add endpoint**:
   - Endpoint URL: `https://YOUR-SITE/api/stripe/webhook`
   - **Listen to: Events on Connected accounts**
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `account.updated`
   - Copy the **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET`, then redeploy.

### 4. Resend email (free; needs a domain)
1. Sign up at https://resend.com → **Domains → Add domain** → add the DNS records it shows at your domain registrar (Cloudflare makes this one click).
2. **API Keys → Create** → `RESEND_API_KEY`. Set `EMAIL_FROM` to something like `TutConnect <hello@yourdomain.com>`.
3. No domain yet? Leave `RESEND_API_KEY` empty: the site still works, but emails are only written to the Netlify function logs.

### 5. Netlify hosting (free)
1. Sign up at https://app.netlify.com with your GitHub account.
2. **Add new project → Import an existing project → GitHub →** pick `tutconnect`. Netlify detects Next.js automatically; `netlify.toml` already sets the build command.
3. Before the first deploy, open **Project configuration → Environment variables** and add everything from `.env.example`:
   `DATABASE_URL`, `DIRECT_URL`, `ADMIN_EMAILS` (your email), `CRON_SECRET` (any long random text), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`.
   `APP_URL` is optional (Netlify provides the site URL); set it once you add a custom domain.
4. Deploy. The build creates the database tables automatically (`prisma migrate deploy`).
5. The hourly job (`netlify/functions/cron.mts`) is picked up automatically. It releases unpaid slot holds, auto-confirms lessons 24h after they end, and sends 24h reminders.

### 6. Make yourself admin
Sign up on your live site with the email you put in `ADMIN_EMAILS`. You land on `/admin`.

### 7. Custom domain (optional, ~$5–11/yr)
Buy it at Cloudflare Registrar or Porkbun, then in Netlify **Domain management → Add a domain** and follow the DNS instructions. Set `APP_URL=https://yourdomain.com` and redeploy.

---

## Test before taking real money

With `sk_test_` keys:
1. Sign up as a tutor, complete the application, approve it from `/admin`.
2. As the tutor, open **Payouts → Connect with Stripe**. In test mode use Stripe's test data (phone `000 000 0000`, SMS code `000000`, SSN `000-00-0000`, bank routing `110000000` account `000123456789`).
3. Add availability. In another browser sign up as a student, book, and pay with card `4242 4242 4242 4242`, any future date, any CVC.
4. Check the booking shows **Confirmed**, the email arrives, and the payment appears in Stripe under the tutor's connected account with your application fee.
5. Try a cancellation, a "Report a problem", and resolving it from `/admin/disputes`.

## Going live
1. In Stripe, click **Activate payments** and complete your business details (Stripe reviews the platform).
2. Switch the keys to live ones (`sk_live_...`) and create a **live** Connect webhook with the same events. Update both env vars in Netlify and redeploy.
3. Read `/terms` and `/privacy` and have them reviewed for your country. They are templates.

## Important limits to know
- **Tutor countries:** Stripe Connect works for tutors in about 46 countries (US, UK, EU, Canada, Australia, Japan, Singapore, UAE, Brazil, Mexico and others). Tutors elsewhere can't receive payouts yet. List: https://stripe.com/global
- **Prices are in USD** for now.
- **Free tiers can change.** Limits above were checked in November 2026.
- **Promoting on Reddit:** most subreddits ban self-promotion or require disclosure. Say you're the founder, link the comparison page, and answer questions honestly. Posts that read like ads usually get removed.
