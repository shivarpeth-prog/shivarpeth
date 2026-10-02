# Code Check Checklist
- [x] Express server syntax checked with `node --check server.js`
- [x] SQLite schema created automatically
- [x] UTR UNIQUE constraint prevents duplicate UTRs
- [x] Screenshot required; only JPG/PNG/WEBP accepted
- [x] Upload size configurable via MAX_UPLOAD_MB
- [x] Admin authentication via signed session cookie
- [x] Approval and post creation are one SQLite transaction
- [x] Rejected/pending posts are not shown in LIVE Posts
- [x] PWA manifest + service worker included
- [x] Razorpay dependency/code absent

# Before going live
- [ ] Put real UPI_ID in `.env`
- [ ] Put real domain in `APP_URL`
- [ ] Change ADMIN_PASSWORD
- [ ] Set strong SESSION_SECRET
- [ ] Enable HTTPS
- [ ] Configure reverse proxy / process manager on hosting
- [ ] Test payment → screenshot + UTR → admin approve → LIVE post
