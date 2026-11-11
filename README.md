# A40 ERP — Cloudflare Pages + D1 Deployment & GitHub Guide

This project is a multi-tenant retail POS, inventory, accounting ledger, purchase order, and HR management ERP built for **Cloudflare Pages** with **Cloudflare D1 (SQLite database)**.

---

## 1. Quick Deploy to Cloudflare Pages via GitHub

When you push this repository to GitHub:
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Compute (Workers & Pages)** → **Pages** → **Connect to Git**.
2. Select your repository.
3. Configure build settings:
   - **Framework preset**: `None` or `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. Under **Environment variables (Production)**:
   - `SUPER_ADMIN_NAME`: `platform` (or your chosen platform super-admin username)
   - `SUPER_ADMIN_PIN`: `1234` (or your secure platform PIN)
5. Click **Save and Deploy**.
6. After initial deployment, go to **Settings** → **Functions** → **D1 database bindings**:
   - Variable name: `DB`
   - D1 database: select your D1 database (e.g. `kingdb`).

---

## 2. Deploy via Wrangler CLI

If deploying from your terminal:

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. (Optional) Create a D1 database if you don't already have one
npx wrangler d1 create kingdb

# 3. Apply the database schema to your remote D1 database
npx wrangler d1 execute kingdb --remote --file=./schema.sql

# 4. Build the frontend
npm run build

# 5. Deploy Pages project
npx wrangler pages deploy dist --project-name=neo-erp
```

---

## 3. How to Create and Access via a Custom D1 User

You can create users directly via D1 SQL query or via the ERP interface:

### Option A: Using Wrangler D1 CLI (Direct SQL)

You can run SQL directly against your Cloudflare D1 database:

```bash
# Add an Admin user with a 4-digit PIN (e.g., PIN: 4321):
npx wrangler d1 execute kingdb --remote --command="INSERT INTO users (id, name, role, pin, phone, status, tenantId) VALUES ('u-my-admin', 'MyCustomAdmin', 'Admin', '4321', '+254 700 000000', 'Active', 'tenant-default');"
```

> **Note on PIN encryption:** The backend automatically upgrades plain PINs (e.g. `'4321'`) to PBKDF2 secure hashes on the very first login, so you can safely insert plain text PINs directly via D1.

To verify existing users in your D1 database:
```bash
npx wrangler d1 execute kingdb --remote --command="SELECT id, name, role, status, tenantId FROM users;"
```

### Option B: Built-in Platform Super-Admin

The platform has a built-in super-admin configured via Cloudflare Environment Variables:
- **Username**: `platform` (or value of `SUPER_ADMIN_NAME`)
- **PIN**: `1234` (or value of `SUPER_ADMIN_PIN`)
- Switch to **Platform Console** on the login screen to manage all tenant shops and users.

---

## 4. Git & GitHub Setup

To initialize and push this repo to your GitHub account:

```bash
# Initialize git if not already initialized
git init -b main

# Add all files
git add .

# Commit
git commit -m "Complete A40 ERP: Cloudflare Pages + D1 integration"

# Link to your GitHub repository (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin main
```
