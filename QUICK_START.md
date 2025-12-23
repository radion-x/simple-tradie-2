# 🚀 Quick Start Guide - Brave Search & Callbacks

## ⚡ TL;DR

**What's New:**
- AI chatbot can now search the web in real-time (Brave API)
- Users can request callbacks directly through chat
- Admin dashboard to manage callback requests
- Email notifications for both admins and customers

**Server Status:** ✅ Running on http://localhost:3000

---

## 🎯 Quick Test (5 minutes)

### 1. Test Search (2 min)
```
1. Open http://localhost:3000
2. Click chat widget
3. Ask: "What are AI marketing trends in 2025?"
4. See: 🔍 search → gradient card with results
```

### 2. Test Callback (2 min)
```
1. Say: "I want a consultation"
2. AI asks for name/contact
3. Reply: "John Smith, john@test.com"
4. See: ✅ green card with reference number
5. Check emails at: jack6nimble@gmail.com, hello@simplepage.com.au
```

### 3. Test Dashboard (1 min)
```
1. Open http://localhost:3000/admin/callbacks.html
2. Login: admin123
3. See: Stats + John's callback in table
4. Change status to "Contacted"
```

---

## 📋 Key URLs

- **Homepage with Chat:** http://localhost:3000
- **Admin Dashboard:** http://localhost:3000/admin/callbacks.html
- **Health Check:** http://localhost:3000/health

---

## 🔑 Credentials

- **Admin Password:** `admin123` (change in `.env` → `ADMIN_DASHBOARD_PASSWORD`)
- **Database:** `postgresql://localhost:5432/websited_dev`

---

## 🛠️ Quick Commands

```bash
# Start server
npm start

# Check database
psql postgresql://localhost:5432/websited_dev

# View callbacks
SELECT * FROM callback_requests;

# View searches
SELECT * FROM search_queries;

# Stop server
pkill -f "node server.js"
```

---

## 📊 Feature Limits

- **Searches per session:** 3 (resets when chat resets)
- **Monthly quota:** 2000 searches (Brave free tier)
- **Warning email:** Sent at 95% quota (1900 searches)

---

## 🐛 Quick Fixes

**Search not working?**
- Check: `BRAVE_SEARCH_API_KEY` in `.env`
- Check: `ENABLE_WEB_SEARCH=true`

**Callbacks not saving?**
- Check: PostgreSQL running (`psql -l`)
- Check: Tables created (server startup logs)

**Dashboard login fails?**
- Check: `ADMIN_DASHBOARD_PASSWORD` in `.env`
- Try: Clear sessionStorage in browser

**Emails not sending?**
- Check: Mailgun credentials in `.env`
- Check: Domain verified in Mailgun dashboard

---

## 📁 Important Files

**Backend:**
- `server.js` - Main server with DB init
- `routes/ai.js` - Function calling logic (800+ lines)
- `routes/callbacks.js` - Admin API endpoints
- `db/schema.sql` - Database tables

**Frontend:**
- `public/js/aiChat.js` - Tool handling + session ID
- `public/admin/callbacks.html` - Admin dashboard

**Config:**
- `.env` - All configuration (7 new variables added)
- `IMPLEMENTATION_STATUS.md` - Full progress tracking
- `TESTING_GUIDE.md` - Comprehensive testing docs

---

## 🔄 Deploy to Coolify

1. **Add PostgreSQL resource** in Coolify
2. **Update env vars** in Coolify dashboard:
   ```
   DATABASE_URL=postgresql://user:pass@postgres:5432/websited
   BRAVE_SEARCH_API_KEY=BSAYg9Xuavv1d4IGRw5gx-B_oz-nbNr
   ADMIN_DASHBOARD_PASSWORD=change-me
   ```
3. **Push to git:**
   ```bash
   git add .
   git commit -m "Add search + callbacks"
   git push
   ```
4. **Coolify auto-deploys** (webhook triggered)

---

## 📧 Email Recipients

- **Admin notifications:** jack6nimble@gmail.com, hello@simplepage.com.au
- **Customer confirmations:** User's provided email address

---

## 🎨 UI Components

**Chat Widget:**
- Tool status messages (🔍 Searching..., 📞 Scheduling...)
- Search results: Gradient purple card with links
- Callback confirmation: Green card with reference ID

**Admin Dashboard:**
- Stats: 6 metric cards at top
- Table: Sortable, filterable, paginated
- Modal: Full conversation context on row click
- Filters: Status, search, date range

---

## 🧪 Test Checklist

- [ ] Search returns results with clickable links
- [ ] Session limit enforced (3 searches max)
- [ ] Callback creates database entry
- [ ] Admin email sent to both addresses
- [ ] Customer email sent with reference number
- [ ] Dashboard login works with password
- [ ] Stats cards show correct counts
- [ ] Status updates in dashboard work
- [ ] Email link `?id=X` highlights row
- [ ] Conversation context displays in modal

---

## 💾 Database Quick Reference

**Tables:**
- `callback_requests` (11 columns, status enum)
- `search_queries` (5 columns, session tracking)

**Common Queries:**
```sql
-- Today's callbacks
SELECT * FROM callback_requests 
WHERE DATE(created_at) = CURRENT_DATE;

-- Pending callbacks
SELECT * FROM callback_requests 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Monthly search count
SELECT COUNT(*) FROM search_queries 
WHERE created_at >= NOW() - INTERVAL '30 days';

-- Search usage by day
SELECT DATE(created_at) as day, COUNT(*) 
FROM search_queries 
GROUP BY DATE(created_at) 
ORDER BY day DESC 
LIMIT 7;
```

---

## 🔐 Security Notes

- Admin password stored in `.env` (change for production)
- Password validated on every API request
- Session ID generated client-side (no server sessions)
- Rate limiting per session (3 searches)
- Monthly quota tracking (2000 searches)

---

## 📈 Monitoring

**Daily:**
- Check admin dashboard for new callbacks
- Monitor email deliveries

**Weekly:**
- Review search quota usage
- Update callback statuses

**Monthly:**
- Check Brave API usage (should be < 2000)
- Review callback conversion rates

---

## 🚨 Known Limitations

1. No SMS notifications (only email)
2. Session limit resets on chat reset (not time-based)
3. Admin dashboard uses simple password (no JWT)
4. No calendar integration (manual scheduling)
5. Search quota shared across all users

---

## 📚 Full Documentation

- **Implementation Status:** `IMPLEMENTATION_STATUS.md` (comprehensive tracking)
- **Testing Guide:** `TESTING_GUIDE.md` (detailed testing + API reference)
- **This File:** `QUICK_START.md` (you are here)

---

## ✅ Success Criteria

**You'll know it's working when:**
1. ✅ Server starts with "✅ Database initialized successfully"
2. ✅ Chat widget searches and returns results
3. ✅ Callback request generates reference ID
4. ✅ Emails arrive at admin addresses
5. ✅ Dashboard shows callbacks and allows status updates

---

**Last Updated:** November 21, 2025  
**Status:** All features complete, ready for testing  
**Next Step:** Run quick test (see top of document)
