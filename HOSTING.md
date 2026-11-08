# Running TutConnect on your own server

One small rented server (VPS) runs everything: the app, the Postgres database, HTTPS, hourly housekeeping and daily backups. No free-tier platforms.

## What it costs

| Item | Pick | Price | Per year |
|---|---|---|---|
| Server | **OVHcloud VPS-1** (2 vCPU, 4 GB RAM, 40 GB NVMe, daily backup included) | €4.49/month, or about €3.81/month paid 12 months upfront | ~$52–62 |
| Domain | `.com` at Cloudflare Registrar (at cost) | ~$10.46–11.17/year | ~$11 |
| HTTPS certificate | Let's Encrypt through Caddy | free | $0 |
| Payments | Stripe Connect | no monthly fee; Stripe takes its card fee per payment from the tutor's share | $0 fixed |
| Email | Amazon SES over SMTP (pay as you go) | $0.10 per 1,000 emails | ~$1 |
| **Total** | | **about $5.50/month** | **about $65 in year one** |

Alternatives: Hetzner CX23 (2 vCPU, 4 GB) is €5.99/month (~$83/yr) and very reliable. Contabo is cheaper per GB but slower to support. Prices were checked in November 2026; Hetzner and netcup raised prices in 2026, so check before ordering.

**$10 is not enough for a year.** It covers the domain, or about two months of the server. A realistic budget is about $65 for the first year.

## Steps

### 1. Buy the domain
Cloudflare Registrar (dash.cloudflare.com → Domain Registration) or Porkbun. Then add two DNS records pointing at your server's IP (step 2):
- `A` record, name `@` → server IP
- `A` record, name `www` → server IP
(On Cloudflare, set both to **DNS only**, grey cloud, so Caddy can get the certificate.)

### 2. Rent the server
Order **OVHcloud VPS-1** with **Ubuntu 24.04**, in the region closest to most users. Add your SSH key during checkout if you have one. You'll get an IP address and root login by email.

### 3. Prepare the server (about 5 minutes)
```bash
ssh root@YOUR_SERVER_IP
curl -fsSL https://raw.githubusercontent.com/YOUR_GITHUB/YOUR_REPO/main/deploy/setup-server.sh -o setup.sh   # or copy the file over
bash setup.sh
```
This installs Docker, turns on the firewall (SSH, 80, 443 only), automatic security updates, fail2ban and a swap file.
For a private repo, create a GitHub deploy key or a fine-grained token with read access, then:
```bash
git clone https://github.com/YOUR_GITHUB/YOUR_REPO.git /opt/app && cd /opt/app
cp .env.example .env && nano .env
```
Fill in at least `DOMAIN`, `APP_URL`, `POSTGRES_PASSWORD`, `CRON_SECRET` (generate each secret with `openssl rand -hex 32`) and `ADMIN_EMAILS`.

### 4. Start it
```bash
docker compose up -d --build
docker compose logs -f app     # wait for "Ready"
```
Open `https://yourdomain.com`. Caddy fetches the HTTPS certificate on the first visit. Sign up with the email in `ADMIN_EMAILS` to become admin.

### 5. Email (Amazon SES)
1. AWS console → **SES** → pick a region → **Verified identities → Create identity → Domain**. Add the DNS records it shows (DKIM) at your registrar.
2. **Request production access** (new SES accounts can only email verified addresses until AWS approves; usually about a day).
3. **SMTP settings → Create SMTP credentials**. Set in `.env`:
   `SMTP_URL=smtps://SMTP_USERNAME:SMTP_PASSWORD@email-smtp.REGION.amazonaws.com:465` (URL-encode any `/` or `+` in the password)
   `EMAIL_FROM="YourBrand <hello@yourdomain.com>"`
4. `docker compose up -d` to apply.
Any other SMTP provider works the same way, as does `RESEND_API_KEY`.

### 6. Payments (Stripe Connect)
1. Sign up at stripe.com. Stay in **Test mode**.
2. **Connect → Get started → Platform or marketplace.**
3. **Developers → API keys** → `STRIPE_SECRET_KEY=sk_test_...`
4. **Developers → Webhooks → Add endpoint**: URL `https://yourdomain.com/api/stripe/webhook`, **Listen to: Events on Connected accounts**, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `account.updated` → `STRIPE_WEBHOOK_SECRET=whsec_...`
5. `docker compose up -d`.

Test it: approve a tutor, connect payouts with Stripe's test data (phone `000 000 0000`, code `000000`), add a slot, book as a student with card `4242 4242 4242 4242`. Check the booking turns **Confirmed** and the payment shows in Stripe with your fee. Then try a cancellation and a "Report a problem".

To go live: **Activate payments** in Stripe, swap in `sk_live_...`, create a live Connect webhook, update `.env`, `docker compose up -d`.

## Day-to-day

| Task | Command (in `/opt/app`) |
|---|---|
| Deploy new code | `./deploy/update.sh` |
| See logs | `docker compose logs -f app` |
| Status | `docker compose ps` |
| Backups | daily in `/opt/app/backups/` (kept 14 days). Copy them off the server now and then: `scp root@IP:/opt/app/backups/*.gz .` |
| Restore a backup | `gunzip -c backups/FILE.sql.gz \| docker compose exec -T db psql -U tutconnect tutconnect` (on an empty database) |

OVHcloud's VPS-1 also includes an automatic daily backup of the whole server.

## Before launch
- Read `/terms` and `/privacy` and have them checked for your country; they are templates.
- Stripe pays out to tutors in about 46 countries: https://stripe.com/global
- Reddit: most subreddits remove ads. Post as the founder, say so, and link the comparison page.
