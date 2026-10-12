# Putting Whoply online

One server in India runs everything with Docker. The database is MongoDB Atlas (Mumbai).
You end up with four web addresses, all on HTTPS:

| Address | What it is |
|---|---|
| `https://yourdomain.com` | Landing site (and `www.` redirects to it) |
| `https://app.yourdomain.com` | The app for shops and wholesalers |
| `https://admin.yourdomain.com` | Your admin panel |
| `https://api.yourdomain.com` | The API (the app and admin talk to it) |

The files for this are in [`deploy/`](deploy/). GitHub builds and starts this exact setup on
every push (the **Docker deploy** check), so it is tested before you use it.

## What it costs (roughly, per month)

| Item | Cost | Notes |
|---|---|---|
| Server, 2 CPU / 4 GB RAM, Mumbai or Bangalore | ₹1,500–2,500 | DigitalOcean (Bangalore), AWS Lightsail (Mumbai), or similar. 2 GB works if you add swap (step 4) |
| MongoDB Atlas | ₹0 to start | Free M0 (512 MB) is enough for the first shops; M10 (about ₹5,000) when you grow — it adds automatic backups |
| Domain name | ₹800–1,000 a year | `.in` or `.com` from any registrar |
| HTTPS certificates | ₹0 | Caddy gets and renews them automatically (Let's Encrypt) |

## Step 1 — Rent the server

1. Create an Ubuntu **24.04** server in a **Mumbai or Bangalore** region, 2 CPU / 4 GB RAM.
2. Add your SSH key when asked (safer than a password).
3. Note the server's **public IP address** (for example `139.59.10.20`).

## Step 2 — Create the database (MongoDB Atlas)

1. Sign up at mongodb.com/atlas → **Create cluster** → **M0 (free)** → provider **AWS**, region
   **Mumbai (ap-south-1)**.
2. **Database Access** → add a user (for example `whoply`) with a strong password.
3. **Network Access** → **Add IP Address** → your server's IP from step 1.
4. **Connect** → **Drivers** → copy the connection string. Put your password in it and add
   `/whoply` before the `?`, like:
   `mongodb+srv://whoply:PASSWORD@cluster0.abcde.mongodb.net/whoply?retryWrites=true&w=majority`

## Step 3 — Point your domain at the server

At your domain registrar, add five **A records**, each pointing to the server IP:

| Name | Type | Value |
|---|---|---|
| `@` | A | your server IP |
| `www` | A | your server IP |
| `app` | A | your server IP |
| `admin` | A | your server IP |
| `api` | A | your server IP |

They usually work within minutes (sometimes a few hours). HTTPS can only be set up after they do.

## Step 4 — Prepare the server

Log in (`ssh root@YOUR_SERVER_IP`) and run these once:

```bash
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
apt -y install unattended-upgrades git
```

Only if the server has 2 GB RAM, add swap (building the sites needs the memory):

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## Step 5 — Get Whoply and fill in the settings

```bash
git clone https://github.com/JayPaneliya2207/Whoply.git
cd Whoply/deploy
cp .env.example .env
openssl rand -hex 48        # copy the output — it is your JWT_SECRET
nano .env                   # fill in DOMAIN, MONGODB_URI, JWT_SECRET; save with Ctrl+O, Enter, Ctrl+X
```

`deploy/.env` holds your secrets. It is not in git — never share it.

## Step 6 — Start everything

```bash
./deploy.sh
```

The first build takes about 10 minutes. The script builds everything, updates the database,
starts it all, and prints the four addresses when the API answers.

## Step 7 — Create your admin login (once)

```bash
docker compose run --rm -e ADMIN_MOBILE=98XXXXXXXX -e ADMIN_PASSWORD='a long password' api node dist/seeds/setup.js
```

This adds the three default plans (edit them later on the admin **Plans** page) and your admin
login. It never adds demo shops. The demo commands (`seed`, `seed:reset`) refuse to run on the
live server, because they delete everything.

Then open `https://admin.yourdomain.com`, sign in, and add the first shop with **Add business**.
Give the owner a password there: OTP sign-in needs an SMS provider, which isn't connected yet.

**Turn on two-step sign-in for your admin login** — this login controls every shop. In the admin
panel open the account menu (top right) → **Two-step sign-in**, scan the QR code with Google
Authenticator or Microsoft Authenticator on your phone, type the code it shows, and save the 8
recovery codes on paper. From then on, signing in needs your password and a code from the phone.

## Step 8 — Phone notifications (optional, once)

Reminders and alerts can reach a phone even when Whoply is closed. The server needs one key pair:

```bash
docker compose run --rm api npm run push:keys:prod
```

Copy the three lines it prints into `deploy/.env` (put your real support email in `VAPID_SUBJECT`),
then run `./deploy.sh` again. Each person turns it on for their own device in the app:
**Notifications → Turn on**. On an iPhone the app must first be installed ("Add to Home Screen").

Make the keys **once**. If they change, every device has to turn notifications on again.

## Updating to a new version

```bash
cd ~/Whoply && git pull && cd deploy && ./deploy.sh
```

Shop data is never touched by an update. The database update step (`migrate`) is safe to repeat.

## Backups

- The API saves a full backup every day into `deploy/backups/whoply/` on the server (the
  newest 14 are kept). On Atlas M10 and above, Atlas keeps its own backups too.
- **Copy them off the server** now and then. From your own computer:
  `scp -r root@YOUR_SERVER_IP:Whoply/deploy/backups ./whoply-backups`
- To put a backup back (this replaces the live data, after saving it first):

```bash
docker compose run --rm api node dist/seeds/restore.js                       # list the backups
docker compose run --rm api node dist/seeds/restore.js whoply-2026-10-01_0215 --drop
```

## Before real shops use it

- [ ] Company details in `whoply-front/src/lib/legal.ts` (the Privacy and Terms pages show "Draft" until then), and a lawyer's review.
- [ ] Try the app on a phone: sign in, make a bill, print, and install it ("Add to Home screen").
- [ ] An SMS provider for OTP sign-in. Until then, owners sign in with the password you set. (Self sign-up is closed on purpose: you add each business in the admin panel.)
- [ ] Copy one backup off the server and check that it restores (for example into a test database with `--into`).
- [ ] Go through the checklist in `SECURITY.md` (secrets, admin logins, database access, uptime monitor).

### Five checks on the live server itself

These can not be seen from the code — do them once, from any computer:

1. **It runs as production.** Open `https://api.yourdomain.com/api/health`: it must say
   `"environment":"production"`. (If it does not, the API also prints a warning when it starts.)
2. **No demo logins.** The demo numbers (9000000001, 9000000010, 9000000099 …) must not exist on
   the live database. In the admin panel, **Users** and **Access control** should list only real
   people. The demo password is refused on a live server either way.
3. **Nobody can sign up alone.** `curl -X POST https://api.yourdomain.com/api/auth/register -H "Content-Type: application/json" -d "{}"`
   must answer "Sign-up is closed".
4. **Only the web ports are open.** From outside, ports 7000, 3000 and 27017 must not answer;
   in Atlas, **Network Access** lists only the server's IP address.
5. **The secrets were made on the server.** `JWT_SECRET` is not the one from your own PC, and
   `deploy/.env` is readable only by you (`chmod 600 deploy/.env`).

## If something goes wrong

Run these from `Whoply/deploy`:

| Problem | What to do |
|---|---|
| See what's running | `docker compose ps` |
| See the API's messages | `docker compose logs api --tail 100` |
| "The API did not start" | Usually `MONGODB_URI`: check the password and that Atlas **Network Access** has the server IP |
| HTTPS not working | The DNS records (step 3) must point to this server; see `docker compose logs caddy` |
| Restart everything | `docker compose restart` |
| An admin lost the phone with the authenticator app | First a recovery code. If none is left: another super admin switches it off on the **Access control** page, or run `docker compose run --rm api node dist/seeds/two-step-off.js 98XXXXXXXX` |
| Out of disk | `docker system prune -f` (removes old images, keeps data and backups) |
