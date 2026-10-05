# Deploying Chicken Casino to Orange Host

The site is a static build (HTML, JS, CSS, images), so any cPanel plan works —
no Node.js or database needed on the host. URLs use `#/` routes, so no rewrite
rules are required, and it works in a subfolder too.

## Option A — automatic (recommended)

Every push to `main` builds the site and uploads it over FTP
(`.github/workflows/deploy-orangehost.yml`).

1. **cPanel → FTP Accounts**: create an account, e.g. `deploy@yourdomain.com`,
   with directory `public_html` (or the folder for your domain).
   Note the FTP server from "Configure FTP Client" (usually `ftp.yourdomain.com`).
2. **GitHub → repo → Settings → Secrets and variables → Actions → New repository secret**:
   - `FTP_SERVER` — e.g. `ftp.yourdomain.com`
   - `FTP_USERNAME` — e.g. `deploy@yourdomain.com`
   - `FTP_PASSWORD` — the account's password
   - Optional *variable* `FTP_DIR` if the site lives somewhere other than
     `public_html/` (e.g. `public_html/casino/`). Must end with `/`.
3. **GitHub → Actions → Deploy to Orange Host → Run workflow** (or push to `main`).

If the host's FTP doesn't support TLS, change `protocol: ftps` to `ftp` in the workflow.

## Option B — manual upload

1. `npm ci && npm run build`
2. Zip the **contents** of `dist/` (not the folder itself).
3. **cPanel → File Manager → public_html → Upload** the zip, then **Extract**.
   Make sure hidden files are shown so `.htaccess` is included.

## After the first upload

- **cPanel → SSL/TLS Status → Run AutoSSL** so `https://` works.
  `.htaccess` redirects all traffic to https once it's active.
- Point your domain's DNS at Orange Host if it's registered elsewhere.

## What `.htaccess` does

Forces https, gzip-compresses text files, caches hashed JS/CSS for a year,
never caches `index.html` (so new uploads show immediately), and adds basic
security headers.

## Data and accounts

Accounts, coins and purchases are still stored in each visitor's browser.
Hosting the files doesn't change that — a backend (e.g. Orange Host's
PHP + MySQL, or Supabase) is the next step for shared accounts.
