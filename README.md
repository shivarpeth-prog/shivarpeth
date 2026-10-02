# Shivar Peth — Working Version

## Features
- Marathi-friendly responsive web app / installable PWA
- UPI payment flow — no Razorpay
- Payment amount defaults to ₹199
- User must submit BOTH UTR/Transaction ID and payment screenshot
- Duplicate UTR rejection
- Admin login
- Admin reviews screenshot + UTR
- Approve → post becomes LIVE
- Reject with admin note
- SQLite database; uploaded screenshots stored in `uploads/`

## Setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env`.
3. Set your real UPI ID, domain, admin username/password and a strong session secret.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000`.
7. Admin: `http://localhost:3000/admin/login`.

## Domain / production
Put this app behind HTTPS (Nginx/Cloudflare or your hosting provider) and set `NODE_ENV=production` plus `APP_URL` to your real domain. Keep `.env`, `data/`, and `uploads/` private from source control. Back up the SQLite DB and uploads.

## Important
This version does NOT automatically verify a bank/UPI payment. The admin manually checks the submitted UTR and screenshot before approval, as requested.
