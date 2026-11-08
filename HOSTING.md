# Running Polyglow on your own server

One small rented server (VPS) runs everything: the app, the Postgres database, HTTPS, hourly housekeeping and daily backups. No free-tier platforms.

## What it costs

You need one server with **at least 2 GB of RAM** (the app, database and HTTPS together use about 700 MB). Three good options, cheapest first. Prices were checked in November 2026 and "+ VAT" means VAT is added if you live in the EU. Check before ordering.

| Server | Specs | Price | Per year | Catch |
|---|---|---|---|---|
| **netcup VPS nano G11s** (cheapest) | 2 vCPU, 2 GB RAM, 60 GB SSD, Germany | €2.59/month + VAT | ~$36–43 | Sold in limited batches, so it isn't always in stock; 6-month minimum; use the prebuilt image (see "Small servers" below) |
| **OVHcloud VPS-1** (my pick) | 2 vCPU, 4 GB RAM, 40 GB NVMe, daily backup included | €4.49/month, about €3.81/month paid yearly | ~$53–62 | None worth worrying about; always available; monthly or yearly |
| netcup VPS 500 G12 | 2 vCPU, 4 GB RAM, 128 GB NVMe | €4.97/month + VAT | ~$69–82 | Costs more than OVHcloud for the same RAM |

Skip these: 1 GB servers such as netcup VPS pico (€1.55) are too tight and will crash under load; IONOS's $2 VPS XS is no longer sold; Hetzner CX23 is now €5.99+ and DigitalOcean, Vultr and Linode charge $5–24 for less.

Everything else:

| Item | Pick | Per year |
|---|---|---|
| Domain | `polyglow.com` (or similar) at Cloudflare Registrar or Porkbun | ~$11 |
| HTTPS certificate | Let's Encrypt through Caddy (built in) | $0 |
| Payments | Stripe Connect: no monthly fee; Stripe takes its card fee per payment from the tutor's share | $0 fixed |
| Email | Amazon SES over SMTP: $0.10 per 1,000 emails | ~$1 |
| Building the app | GitHub Actions (included in your GitHub account: 2,000 minutes/month on private repos) | $0 |

**Totals for year one:** about **$50** on the netcup nano (about $4/month) or about **$65** on OVHcloud VPS-1 (about $5.50/month).

**$10 is not enough for a year.** It covers the domain, or two to three months of the cheapest server.

## Steps

### 1. Buy the domain
Cloudflare Registrar (dash.cloudflare.com → Domain Registration) or Porkbun. Then add two DNS records pointing at your server's IP (step 2):
- `A` record, name `@` → server IP
- `A` record, name `www` → server IP
(On Cloudflare, set both to **DNS only**, grey cloud, so Caddy can get the certificate.)

### 2. Rent the server
Order **OVHcloud VPS-1** (or the netcup nano if it's in stock) with **Ubuntu 24.04**, in the region closest to most users. Add your SSH key during checkout if you have one. You'll get an IP address and root login by email.

### 3. Prepare the server (about 5 minutes)
The repo is private, so first make a read-only token: GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate, repository **Coldbalouba/Polyglow**, permission **Contents: Read-only**. Then:
```bash
ssh root@YOUR_SERVER_IP
apt-get update && apt-get install -y git
git clone https://github.com/Coldbalouba/Polyglow.git /opt/app   # username: your GitHub name, password: the token
cd /opt/app && bash deploy/setup-server.sh
cp .env.example .env && nano .env
```
`setup-server.sh` installs Docker, turns on the firewall (SSH, 80, 443 only), automatic security updates, fail2ban and a swap file.
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

## Small servers (2 GB): use the prebuilt image
Building the app needs more memory than running it. On a 2 GB server, let GitHub build it instead:
1. Every push to `main` runs the **CI** workflow (Actions tab), which tests the code and publishes the image `ghcr.io/coldbalouba/polyglow`.
2. Make a classic token with only the **read:packages** scope (GitHub → Settings → Developer settings → Tokens (classic)). On the server:
   `echo YOUR_TOKEN | docker login ghcr.io -u Coldbalouba --password-stdin`
3. In `.env` set `APP_IMAGE="ghcr.io/coldbalouba/polyglow:latest"`.
4. `docker compose pull app && docker compose up -d --no-build`. From then on `./deploy/update.sh` pulls instead of building.

On a 4 GB server you can skip this and build on the server.

The containers are capped so they can't starve each other (app 512 MB, database 384 MB, Caddy and jobs 128 MB each), and Postgres is tuned for small machines. `https://yourdomain.com/api/health` returns `{"ok":true}` when the app and database are up; point a monitor such as UptimeRobot at it if you want alerts.

## Day-to-day

| Task | Command (in `/opt/app`) |
|---|---|
| Deploy new code | `./deploy/update.sh` |
| See logs | `docker compose logs -f app` |
| Status | `docker compose ps` |
| Backups | daily in `/opt/app/backups/` (kept 14 days). Copy them off the server now and then: `scp root@IP:/opt/app/backups/*.gz .` |
| Restore a backup | `gunzip -c backups/FILE.sql.gz \| docker compose exec -T db psql -U polyglow polyglow` (on an empty database) |

OVHcloud's VPS-1 also includes an automatic daily backup of the whole server.

## Before launch
- Read `/terms` and `/privacy` and have them checked for your country; they are templates.
- Stripe pays out to tutors in about 46 countries: https://stripe.com/global
- Reddit: most subreddits remove ads. Post as the founder, say so, and link the comparison page.
