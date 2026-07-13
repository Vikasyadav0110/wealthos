# WealthOS — Deployment Roadmap (AWS EC2 + Jenkins + Domain)

A beginner-friendly, step-by-step guide to deploy WealthOS on a single AWS EC2
server, with a custom domain, HTTPS, and optional Jenkins auto-deploy.

> **Reality check:** ~7 phases, a couple of hours. You'll copy-paste commands
> into a terminal — that's normal. If a command fails, copy the error and ask
> for help; nothing here can hurt your own computer (it all runs on the rented
> AWS server).

**Step legend:** `[AWS]` = AWS Console · `[Terminal]` = your terminal / server
shell · `[Browser]` = a web browser · `[Code]` = a file in this repo.

---

## Architecture

```
Your domain (e.g. wealthos.com)
        │  DNS points to →
   AWS EC2 server (a rented Linux computer, always on)
        ├─ Nginx        → handles web traffic + HTTPS padlock
        ├─ Your app     → runs on port 4000 (kept alive by "pm2")
        ├─ data file    → your entries, saved on the server's disk (EBS)
        └─ Jenkins      → auto-redeploys when you push code to GitHub
```

Chosen setup: **single EC2 VM** (persistent EBS disk → the file-based storage
keeps working as-is, no database needed), **Jenkins on the same box**, deploy
from the **`main`** branch.

---

## PHASE 0 — Prep (before touching AWS)

| # | Step | Where | How |
|---|------|-------|-----|
| 0.1 | Merge your code to `main` | [Browser] | Open a PR for your branch on GitHub → Merge into `main` |
| 0.2 | Buy a domain (optional) | [Browser] | Namecheap / GoDaddy / AWS Route 53 (~₹800–1000/yr). Skip to use the raw IP for now |
| 0.3 | Have your Anthropic API key ready | — | You'll paste it on the server (Phase 4) |
| 0.4 | Generate deploy code pieces | [Code] | Ask to create: `Jenkinsfile`, the `DATA_DIR` data-safety change, `nginx-wealthos.conf` |

---

## PHASE 1 — Rent the server (EC2)  ·  ~20 min

| # | Step | Where | How |
|---|------|-------|-----|
| 1.1 | Sign in to AWS | [AWS] | console.aws.amazon.com |
| 1.2 | Search "EC2" → **Launch instance** | [AWS] | |
| 1.3 | Name it | [AWS] | `wealthos` |
| 1.4 | Pick OS | [AWS] | **Ubuntu Server 24.04 LTS** |
| 1.5 | Pick size | [AWS] | **t3.small** (~$15/mo, runs everything). Cheapest: `t2.micro` (free 1yr, tight) |
| 1.6 | Create key pair | [AWS] | "Create new key pair" → name `wealthos-key` → **download the `.pem`** → keep it safe (it's your server password) |
| 1.7 | Network → allow ports | [AWS] | ✅ Allow HTTP, ✅ Allow HTTPS (SSH is on by default) |
| 1.8 | Storage | [AWS] | 20 GB (default gp3) |
| 1.9 | **Launch instance** | [AWS] | Orange button |
| 1.10 | Note the server IP | [AWS] | Instances → click `wealthos` → copy **Public IPv4 address** (e.g. `13.234.x.x`) |

---

## PHASE 2 — Connect to the server  ·  ~10 min

| # | Step | Where | How |
|---|------|-------|-----|
| 2.1 | Open a terminal | [Terminal] | Mac: Terminal · Windows: PowerShell |
| 2.2 | Go to the key's folder | [Terminal] | `cd Downloads` (wherever the `.pem` is) |
| 2.3 | Lock the key (Mac/Linux) | [Terminal] | `chmod 400 wealthos-key.pem` |
| 2.4 | Connect | [Terminal] | `ssh -i wealthos-key.pem ubuntu@<YOUR-IP>` → type `yes` |
| ✅ | You're in | — | Prompt shows `ubuntu@ip-...` |

---

## PHASE 3 — Install what the app needs  ·  ~15 min

Paste one block at a time (on the server):

| # | Installs | Command |
|---|----------|---------|
| 3.1 | Update the server | `sudo apt update && sudo apt upgrade -y` |
| 3.2 | Node.js 20 + git | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt install -y nodejs git` |
| 3.3 | pm2 (keeps app alive) | `sudo npm install -g pm2` |
| 3.4 | Nginx (web server) | `sudo apt install -y nginx` |

---

## PHASE 4 — First manual deploy  ·  ~15 min

| # | Step | Command |
|---|------|---------|
| 4.1 | Download your code | `cd ~ && git clone https://github.com/Vikasyadav0110/wealthos.git && cd wealthos` |
| 4.2 | Checkout main | `git checkout main` |
| 4.3 | Create the secrets file | `nano .env.local` → paste `ANTHROPIC_API_KEY=your-key-here` (and optional `NEWSAPI_KEY=...`) → save: `Ctrl+O`, `Enter`, `Ctrl+X` |
| 4.4 | Install & build | `npm ci && npm run build` (a few min) |
| 4.5 | Start the app | `pm2 start "npm run start" --name wealthos && pm2 save` |
| 4.6 | Survive reboots | `pm2 startup` → copy-paste and run the command it prints |
| 4.7 | Test | `curl localhost:4000` → prints HTML |

---

## PHASE 5 — Make it reachable (Nginx reverse proxy)  ·  ~15 min

| # | Step | Where | How |
|---|------|-------|-----|
| 5.1 | Get the Nginx config | [Code] | Use `nginx-wealthos.conf` from this repo (ask to generate it) |
| 5.2 | Create the config | [Terminal] | `sudo nano /etc/nginx/sites-available/wealthos` → paste the config → save |
| 5.3 | Enable it | [Terminal] | `sudo ln -s /etc/nginx/sites-available/wealthos /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default` |
| 5.4 | Apply | [Terminal] | `sudo nginx -t && sudo systemctl reload nginx` |
| 5.5 | Test | [Browser] | `http://<YOUR-IP>` → your app loads 🎉 |

Minimal Nginx config (if you don't have the file yet — replace the IP/domain in `server_name`):

```nginx
server {
    listen 80;
    server_name <YOUR-IP-OR-DOMAIN>;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## PHASE 6 — Domain + HTTPS padlock  ·  ~20 min

| # | Step | Where | How |
|---|------|-------|-----|
| 6.1 | Point domain to the server | [Browser] | At your domain provider → DNS → add **A record**: Host `@` → `<YOUR-IP>`. Add another: Host `www` → `<YOUR-IP>` |
| 6.2 | Wait for DNS | — | 10 min–few hours |
| 6.3 | Put the domain in Nginx | [Terminal] | Set `server_name yourdomain.com www.yourdomain.com;` → `sudo systemctl reload nginx` |
| 6.4 | Install free HTTPS | [Terminal] | `sudo apt install -y certbot python3-certbot-nginx` |
| 6.5 | Get the padlock 🔒 | [Terminal] | `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com` → enter email, agree |
| 6.6 | Done | [Browser] | `https://yourdomain.com` → secure padlock, app live |

---

## PHASE 7 — Jenkins auto-deploy (optional, do last)  ·  ~40 min

*Makes the app auto-update on `git push`. You can skip this and just re-run
Phase 4's build+restart manually when you change code.*

| # | Step | Where | How |
|---|------|-------|-----|
| 7.1 | Open Jenkins port | [AWS] | EC2 → Security Groups → add inbound rule: port **8080**, source **My IP** |
| 7.2 | Install Java | [Terminal] | `sudo apt install -y openjdk-17-jre` |
| 7.3 | Install Jenkins | [Terminal] | Follow the official install: https://www.jenkins.io/doc/book/installing/linux/#debianubuntu — then `sudo systemctl enable --now jenkins` |
| 7.4 | Unlock Jenkins | [Browser] | `http://<YOUR-IP>:8080` → password: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword` |
| 7.5 | Setup wizard | [Browser] | Install **suggested plugins** → create admin login |
| 7.6 | Add the Jenkinsfile | [Code] | Use `Jenkinsfile` from this repo (ask to generate it) → commit to `main` |
| 7.7 | Create Pipeline job | [Browser] | New Item → **Pipeline** → "Pipeline script from SCM" → your GitHub URL + branch `main` |
| 7.8 | GitHub webhook | [Browser] | GitHub repo → Settings → Webhooks → payload URL `http://<YOUR-IP>:8080/github-webhook/` |
| 7.9 | Let Jenkins restart the app | [Terminal] | Ensure the `jenkins` user can run `pm2 restart wealthos` (e.g. run pm2 as a shared user, or deploy as `ubuntu` via a sudo rule) |
| ✅ | Push → auto-deploy | — | Every push to `main` rebuilds & restarts the app |

---

## 🔒 CRITICAL — protect your data from deploy-wipe (do before Phase 7)

Your entries save to a file on the server. **When Jenkins redeploys, a clean
checkout / `git clean` can delete that file** — the same data-loss you hit
locally.

**Fix (a small code change to request):** add a `DATA_DIR` environment override
so the data file lives at a fixed path *outside* the code folder, e.g.
`/home/ubuntu/wealthos-data/`. Then set `DATA_DIR=/home/ubuntu/wealthos-data`
in `.env.local` on the server. Redeploys can never touch it.

Until that's in place: **never** point a deploy script at `rm -rf` on the
project folder, and keep `data/` out of any clean step.

Also: `data/` is gitignored (never committed), and the in-app
**Settings → Download Backup (.json)** still works as a manual backup.

---

## 💰 Cost summary

| Item | Cost |
|---|---|
| EC2 t3.small (24/7) | ~$15/mo (~₹1,250) |
| EC2 t2.micro (free tier, 1 yr) | ₹0 (may be slow with Jenkins) |
| Domain | ~₹800–1,000/yr |
| HTTPS (Let's Encrypt) | Free |
| EBS storage | ~₹150/mo (included) |

**Cheaper alternative to always-on Jenkins:** use **GitHub Actions** to build +
SSH-deploy instead of hosting Jenkins — then a `t2.micro` (free tier) can run
just the app.

---

## Redeploy manually (no Jenkins)

When you change code and want it live:

```bash
ssh -i wealthos-key.pem ubuntu@<YOUR-IP>
cd ~/wealthos
git pull
npm ci && npm run build
pm2 restart wealthos
```

---

## Quick reference — the whole flow

| Phase | What | Where |
|---|---|---|
| 0 | Merge branch → main; (optional) buy domain | GitHub / registrar |
| 1 | Launch EC2 (Ubuntu, t3.small, key pair, HTTP/HTTPS) | AWS Console |
| 2 | SSH into the server | Terminal |
| 3 | Install Node 20, git, pm2, Nginx | Terminal |
| 4 | Clone, `.env.local`, build, pm2 start | Terminal |
| 5 | Nginx reverse proxy (:80 → :4000) | Terminal |
| 6 | Point domain (A records) + HTTPS (certbot) | Registrar + Terminal |
| 7 | Jenkins + Jenkinsfile + webhook = auto-deploy | Jenkins + GitHub |
| 🔒 | `DATA_DIR` override so deploys can't wipe data | Code + `.env.local` |
