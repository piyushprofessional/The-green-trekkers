require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (_) { nodemailer = null; }
let Resend;
try { ({ Resend } = require('resend')); } catch (_) { Resend = null; }

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const NODE_ENV = process.env.NODE_ENV || 'development';
const tokenSecret = JWT_SECRET || 'LOCAL_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT_1234567890';

if (!JWT_SECRET || JWT_SECRET.length < 32) console.warn('SECURITY WARNING: Set JWT_SECRET in .env with at least 32 random characters before using this for business.');
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) console.warn('SECURITY WARNING: Set ADMIN_EMAIL and a strong ADMIN_PASSWORD in .env before using this for business.');

function sanitizeString(value, max = 200) { return String(value || '').trim().slice(0, max); }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function isPhone(value) { return /^[0-9]{10}$/.test(String(value || '')); }
function id(prefix) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`; }
function safeUser(user) { return { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role || 'user' }; }

function parseCouponConfig(value) {
  const fallback = 'HAPPYGREEN10:10,HAPPYGREEN20:20,HAPPYGREEN50:50,HAPPYGREEN100:100';
  return String(value || fallback).split(',').map(item => item.trim()).filter(Boolean).reduce((map, item) => {
    const [rawCode, rawPercent] = item.split(':');
    const code = sanitizeString(rawCode, 40).toUpperCase().replace(/\s+/g, '');
    const percent = Math.max(0, Math.min(Number(rawPercent) || 0, 100));
    if (code && percent > 0) map[code] = percent;
    return map;
  }, {});
}
const privateCoupons = parseCouponConfig(process.env.COUPON_CODES);
function calculateDiscount(couponCode, subtotal) {
  const code = sanitizeString(couponCode, 40).toUpperCase().replace(/\s+/g, '');
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (!code) return { couponCode: '', couponPercent: 0, discountAmount: 0, total: safeSubtotal };
  const couponPercent = privateCoupons[code];
  if (!couponPercent) return null;
  const discountAmount = Math.round(safeSubtotal * couponPercent / 100);
  return { couponCode: code, couponPercent, discountAmount, total: Math.max(0, safeSubtotal - discountAmount) };
}

const ALLOWED_TREK = 'Harishchandragad Trek';
const ALLOWED_DATE = '04 July 2026, 11:00 PM';
const ALLOWED_PRICE = 1199;
const ALLOWED_PICKUPS = ['Moshi', 'Chakan'];
const DEFAULT_SEAT_LIMIT = Number(process.env.HARISHCHANDRAGAD_SEAT_LIMIT || 30);

const defaultTreks = [
  { id: 'T-RAJ', name: 'Rajmachi Fort Trek', difficulty: 'Beginner', duration: '1 Day / 1 Night', description: 'Night trail near Lonavala with fireflies and forest route.', available: false, inclusions: ['Basic trek leader guidance', 'Route coordination', 'Group support'], exclusions: ['Meals unless mentioned', 'Personal expenses', 'Insurance', 'Anything not mentioned in inclusions'] },
  { id: 'T-KAL', name: 'Kalsubai Peak Trek', difficulty: 'Moderate', duration: '1 Day', description: "Maharashtra's highest peak with sunrise views.", available: false, inclusions: ['Trek leader guidance', 'Route coordination', 'Basic first aid'], exclusions: ['Meals unless mentioned', 'Personal expenses', 'Insurance', 'Transport unless mentioned'] },
  { id: 'T-DEV', name: 'Devkund Waterfall Trek', difficulty: 'Beginner', duration: '1 Day', description: 'Jungle trail ending at a waterfall.', available: false, inclusions: ['Guide support', 'Route coordination', 'Basic first aid'], exclusions: ['Meals unless mentioned', 'Personal expenses', 'Insurance', 'Entry charges if any'] },
  { id: 'T-HAR', name: ALLOWED_TREK, difficulty: 'Difficult', duration: '1 Day / 1 Night', description: 'Konkan Kada, caves and sunrise route. Fixed batch starts on 04 July at 11:00 PM.', available: true, inclusions: ['Experienced trek leader', 'Route guidance', 'Basic first-aid support', 'Pickup/drop coordination from Moshi or Chakan', 'Booking confirmation ticket'], exclusions: ['Meals unless specifically announced', 'Personal expenses', 'Trekking shoes/rainwear/torch', 'Travel insurance', 'Anything not mentioned in inclusions'] },
  { id: 'T-SAN', name: 'Sandhan Valley Trek', difficulty: 'Adventure', duration: '2 Days', description: 'Camping, valley route and adventure patches.', available: false, inclusions: ['Guide support', 'Route coordination', 'Basic first aid'], exclusions: ['Meals unless mentioned', 'Personal expenses', 'Insurance', 'Rental gear'] },
  { id: 'T-AND', name: 'Andharban Jungle Trek', difficulty: 'Moderate', duration: '1 Day', description: 'Descending forest trek with mist and waterfalls.', available: false, inclusions: ['Guide support', 'Route coordination', 'Basic first aid'], exclusions: ['Meals unless mentioned', 'Personal expenses', 'Insurance', 'Transport unless mentioned'] }
];

const defaultBatches = [
  { id: 'B-RAJ-01', trek: 'Rajmachi Fort Trek', note: 'Night trail + fireflies', date: 'Coming Soon', price: 1299, seatLimit: 0, available: false },
  { id: 'B-KAL-01', trek: 'Kalsubai Peak Trek', note: 'Highest peak of Maharashtra', date: 'Coming Soon', price: 1599, seatLimit: 0, available: false },
  { id: 'B-DEV-01', trek: 'Devkund Waterfall Trek', note: 'Forest walk + waterfall', date: 'Coming Soon', price: 1499, seatLimit: 0, available: false },
  { id: 'B-HAR-01', trek: ALLOWED_TREK, note: 'Konkan Kada sunrise batch', date: ALLOWED_DATE, price: ALLOWED_PRICE, seatLimit: DEFAULT_SEAT_LIMIT, available: true },
  { id: 'B-SAN-01', trek: 'Sandhan Valley Trek', note: 'Camping + adventure trail', date: 'Coming Soon', price: 2999, seatLimit: 0, available: false },
  { id: 'B-AND-01', trek: 'Andharban Jungle Trek', note: 'Mist, forest + waterfall trail', date: 'Coming Soon', price: 1799, seatLimit: 0, available: false }
];

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], treks: defaultTreks, batches: defaultBatches, bookings: [], gallerySubmissions: [] }, null, 2));
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.treks) || !db.treks.length) db.treks = defaultTreks;
  if (!Array.isArray(db.batches) || !db.batches.length) db.batches = defaultBatches;
  if (!Array.isArray(db.bookings)) db.bookings = [];
  if (!Array.isArray(db.gallerySubmissions)) db.gallerySubmissions = [];
  // Keep current business configuration synced.
  db.treks = defaultTreks.map(def => ({ ...def, ...(db.treks.find(t => t.id === def.id) || {}) }));
  db.batches = defaultBatches.map(def => ({ ...def, ...(db.batches.find(b => b.id === def.id) || {}) }));
  const harishBatch = db.batches.find(b => b.id === 'B-HAR-01');
  if (harishBatch) { harishBatch.trek = ALLOWED_TREK; harishBatch.date = ALLOWED_DATE; harishBatch.price = ALLOWED_PRICE; harishBatch.available = true; harishBatch.seatLimit = Number(harishBatch.seatLimit || DEFAULT_SEAT_LIMIT); }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function findBatch(db, trek, date) { return db.batches.find(batch => batch.trek === trek && batch.date === date) || null; }
function bookedMembersFor(db, trek, date) {
  return db.bookings.filter(b => b.trek === trek && b.date === date && String(b.paymentStatus || '').toLowerCase() !== 'payment rejected').reduce((sum, b) => sum + (Number(b.members) || 1), 0);
}
function enrichBatches(db) {
  return db.batches.map(batch => {
    const seatLimit = Number(batch.seatLimit || 0);
    const bookedMembers = bookedMembersFor(db, batch.trek, batch.date);
    const availableSeats = Math.max(0, seatLimit - bookedMembers);
    return { ...batch, seatLimit, bookedMembers, availableSeats, available: Boolean(batch.available) && availableSeats > 0 };
  });
}

function signToken(payload) { return jwt.sign(payload, tokenSecret, { expiresIn: '8h' }); }
function cookieOptions() { return { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }; }
function clearCookieOptions() { return { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production' }; }
function getToken(req) { return req.cookies.gt_session || ''; }
function getAuth(req) { try { return jwt.verify(getToken(req), tokenSecret); } catch (_) { return null; } }
function requireAuth(req, res, next) { const auth = getAuth(req); if (!auth) return res.status(401).json({ error: 'Login required' }); req.auth = auth; next(); }
function requireAdmin(req, res, next) { const auth = getAuth(req); if (!auth || auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' }); req.auth = auth; next(); }
function adminPageGuard(req, res, next) { const auth = getAuth(req); if (!auth || auth.role !== 'admin') return res.redirect('/admin-login.html'); next(); }

app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: true, legacyHeaders: false });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'The Green Trekkers Secure API' }));
app.get('/api/me', (req, res) => { const auth = getAuth(req); if (!auth) return res.status(401).json({ error: 'Login required' }); res.json({ user: auth }); });

// Legacy customer auth routes retained, but public booking does not require them.
app.post('/api/signup', loginLimiter, async (req, res) => {
  const db = readDb();
  const name = sanitizeString(req.body.name, 80), email = sanitizeString(req.body.email, 120).toLowerCase(), phone = sanitizeString(req.body.phone, 10), password = String(req.body.password || '');
  if (!name || !isEmail(email) || !isPhone(phone) || password.length < 8) return res.status(400).json({ error: 'Invalid signup details' });
  if (db.users.some(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });
  const user = { id: id('U'), name, email, phone, role: 'user', passwordHash: await bcrypt.hash(password, 10), createdAt: new Date().toISOString() };
  db.users.push(user); writeDb(db); const publicUser = safeUser(user); res.cookie('gt_session', signToken(publicUser), cookieOptions()); res.status(201).json({ user: publicUser });
});
app.post('/api/login', loginLimiter, async (req, res) => {
  const db = readDb();
  const email = sanitizeString(req.body.email, 120).toLowerCase(), password = String(req.body.password || '');
  const user = db.users.find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ error: 'Invalid email or password' });
  const publicUser = safeUser(user); res.cookie('gt_session', signToken(publicUser), cookieOptions()); res.json({ user: publicUser });
});
app.post('/api/logout', (req, res) => { res.clearCookie('gt_session', clearCookieOptions()); res.json({ ok: true }); });

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const email = sanitizeString(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return res.status(500).json({ error: 'Admin credentials are not configured.' });
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin credentials' });
  const admin = { id: 'ADMIN', name: 'Admin', email, phone: '', role: 'admin' };
  res.cookie('gt_session', signToken(admin), cookieOptions()); res.json({ admin });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('gt_session', clearCookieOptions()); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => { const auth = getAuth(req); if (!auth || auth.role !== 'admin') return res.status(403).json({ error: 'Admin access required' }); res.json({ admin: auth }); });

app.get('/api/treks', (req, res) => res.json(readDb().treks));
app.get('/api/batches', (req, res) => { const db = readDb(); res.json(enrichBatches(db)); });

app.post('/api/coupons/validate', (req, res) => {
  const subtotal = Math.max(0, Number(req.body.subtotal) || 0);
  const result = calculateDiscount(req.body.couponCode, subtotal);
  if (!result) return res.status(400).json({ error: 'Invalid coupon code.' });
  res.json(result);
});

app.post('/api/bookings', (req, res) => {
  const db = readDb();
  const trek = sanitizeString(req.body.trek, 120);
  const date = sanitizeString(req.body.date, 80);
  if (trek !== ALLOWED_TREK || date !== ALLOWED_DATE) return res.status(400).json({ error: 'Only Harishchandragad Trek on 04 July 2026 at 11:00 PM is open for booking.' });
  const batch = findBatch(db, trek, date);
  if (!batch || batch.available === false) return res.status(400).json({ error: 'This batch is currently unavailable.' });
  const members = Math.max(1, Math.min(Number(req.body.members) || 1, 10));
  const bookedMembers = bookedMembersFor(db, trek, date);
  const seatLimit = Number(batch.seatLimit || DEFAULT_SEAT_LIMIT);
  const availableSeats = Math.max(0, seatLimit - bookedMembers);
  if (members > availableSeats) return res.status(409).json({ error: `Only ${availableSeats} seats are available for this batch.` });
  const amount = Math.max(0, Number(batch.price) || ALLOWED_PRICE);
  const subtotal = amount * members;
  const discountResult = calculateDiscount(req.body.couponCode, subtotal);
  if (!discountResult) return res.status(400).json({ error: 'Invalid coupon code.' });

  const customerName = sanitizeString(req.body.customerName, 80);
  const email = sanitizeString(req.body.email, 120).toLowerCase();
  const phone = sanitizeString(req.body.phone, 10);
  const pickup = sanitizeString(req.body.pickup, 120);
  const dropPoint = sanitizeString(req.body.dropPoint, 120);
  const memberDetails = Array.isArray(req.body.memberDetails) ? req.body.memberDetails.slice(0, 10).map((m, index) => ({ name: sanitizeString(m.name, 80), age: Number(m.age) || 0, memberNo: index + 1 })) : [];

  if (!customerName || !isEmail(email) || !isPhone(phone)) return res.status(400).json({ error: 'Missing or invalid booking contact details.' });
  if (!ALLOWED_PICKUPS.includes(pickup)) return res.status(400).json({ error: 'Pickup point must be Moshi or Chakan.' });
  if (!ALLOWED_PICKUPS.includes(dropPoint)) return res.status(400).json({ error: 'Drop point must be Moshi or Chakan.' });
  if (memberDetails.length !== members || memberDetails.some(m => m.name.length < 2 || m.age < 5 || m.age > 75)) return res.status(400).json({ error: 'Name and age are required for every member.' });
  if (req.body.consentAccepted !== true) return res.status(400).json({ error: 'Terms and trek consent must be accepted before booking.' });

  const paymentModeFromClient = sanitizeString(req.body.paymentMode, 80);
  const paymentStatusFromClient = sanitizeString(req.body.paymentStatus || 'Payment Pending', 80);
  if (discountResult.total > 0 && !paymentModeFromClient) return res.status(400).json({ error: 'Payment status is required.' });

  const booking = {
    bookingId: sanitizeString(req.body.bookingId || id('GT'), 40),
    trek, date, price: `₹${amount}`, members, memberDetails, amount, subtotal,
    couponCode: discountResult.couponCode, couponPercent: discountResult.couponPercent, discountAmount: discountResult.discountAmount, total: discountResult.total,
    customerName, email, phone, pickup, dropPoint,
    paymentMode: discountResult.total === 0 ? 'Coupon / Free Booking' : paymentModeFromClient,
    paymentStatus: discountResult.total === 0 ? 'Coupon Free Booking' : paymentStatusFromClient,
    paymentScreenshot: sanitizeString(req.body.paymentScreenshot, 160),
    consentAccepted: true,
    termsVersion: '2026-06-22',
    termsAcceptedAt: sanitizeString(req.body.termsAcceptedAt || new Date().toISOString(), 40),
    bookedAt: new Date().toISOString(),
    userId: 'public-guest'
  };
  db.bookings.push(booking); writeDb(db); res.status(201).json(booking);
});

app.post('/api/send-confirmation', async (req, res) => {
  try {
    const booking = req.body.booking;
    if (!booking) return res.status(400).json({ error: 'Booking required' });

    const subject = `The Green Trekkers Booking ${sanitizeString(booking.bookingId, 40)}`;
    const memberText = Array.isArray(booking.memberDetails) ? booking.memberDetails.map((m, i) => `${i + 1}. ${sanitizeString(m.name, 80)} (${Number(m.age) || 0} yrs)`).join('\n') : '';
    const text = `Hello ${sanitizeString(booking.customerName, 80)},\n\nYour trek booking has been received.\n\nBooking ID: ${sanitizeString(booking.bookingId, 40)}\nTrek: ${sanitizeString(booking.trek, 120)}\nDate: ${sanitizeString(booking.date, 80)}\nMembers: ${Number(booking.members) || 1}\n${memberText}\nPickup: ${sanitizeString(booking.pickup, 80)}\nDrop: ${sanitizeString(booking.dropPoint, 80)}\nSubtotal: Rs. ${Number(booking.subtotal || 0)}\nCoupon: ${sanitizeString(booking.couponCode || 'Not applied', 40)}\nDiscount: Rs. ${Number(booking.discountAmount || 0)}\nTotal: Rs. ${Number(booking.total || 0)}\nPayment Status: ${sanitizeString(booking.paymentStatus, 80)}\n\nTerms and trek consent: Accepted\n\nSupport: 9535917287 / 8668971953\nEmail: thegreentrekkers5@gmail.com\nFeedback: mailto:thegreentrekkers5@gmail.com?subject=The%20Green%20Trekkers%20Feedback\nWhatsApp Channel: https://whatsapp.com/channel/0029Vb8vXbYDjiOiMpjSqh1X\nInstagram: https://www.instagram.com/the_green_trekkers?igsh=MTM0dnI0cDhzcHhn`;

    // Preferred on Render Free: Resend uses HTTPS API, not blocked SMTP ports.
    if (Resend && process.env.RESEND_API_KEY && booking.email) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: process.env.MAIL_FROM || 'The Green Trekkers <onboarding@resend.dev>',
        to: booking.email,
        subject,
        text
      });
      return res.json({ sent: true, provider: 'resend' });
    }

    // Local fallback: Gmail/SMTP. This may timeout on Render Free because SMTP ports are blocked.
    if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && booking.email) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: booking.email, subject, text });
      return res.json({ sent: true, provider: 'smtp' });
    }

    console.log('\n--- EMAIL CONFIRMATION DEMO ---');
    console.log(subject);
    console.log(text);
    console.log('Set RESEND_API_KEY and MAIL_FROM on Render to send real email.');
    return res.json({ sent: false, demo: true, message: 'Email printed in server console because email provider is not configured.' });
  } catch (error) {
    console.error('Email confirmation failed:', error.message || error);
    return res.json({
      sent: false,
      warning: 'Booking is saved, but confirmation email could not be sent. Check RESEND_API_KEY/MAIL_FROM or SMTP settings.'
    });
  }
});

app.get('/api/gallery/approved', (req, res) => {
  const db = readDb();
  res.json(db.gallerySubmissions.filter(item => item.status === 'approved').map(item => ({ id: item.id, caption: item.caption, imageData: item.imageData, approvedAt: item.approvedAt })));
});
app.post('/api/gallery/submit', (req, res) => {
  const uploaderName = sanitizeString(req.body.uploaderName, 80);
  const uploaderEmail = sanitizeString(req.body.uploaderEmail, 120).toLowerCase();
  const caption = sanitizeString(req.body.caption, 120);
  const imageData = String(req.body.imageData || '');
  const fileName = sanitizeString(req.body.fileName, 160);
  if (!uploaderName || !isEmail(uploaderEmail) || !caption) return res.status(400).json({ error: 'Name, email and caption are required.' });
  if (!imageData.startsWith('data:image/') || imageData.length > 3_500_000) return res.status(400).json({ error: 'Invalid image. Please upload a photo below 2 MB.' });
  const db = readDb();
  const item = { id: id('G'), uploaderName, uploaderEmail, caption, fileName, imageData, status: 'pending', submittedAt: new Date().toISOString() };
  db.gallerySubmissions.push(item); writeDb(db); res.status(201).json({ ok: true, status: 'pending' });
});

app.get('/api/admin/dashboard', requireAdmin, (req, res) => { const db = readDb(); res.json({ ...db, batches: enrichBatches(db) }); });
app.post('/api/admin/treks', requireAdmin, (req, res) => {
  const db = readDb();
  const trek = { id: sanitizeString(req.body.id || id('T'), 40), name: sanitizeString(req.body.name, 120), difficulty: sanitizeString(req.body.difficulty, 40), duration: sanitizeString(req.body.duration, 60), description: sanitizeString(req.body.description, 300), available: Boolean(req.body.available), inclusions: Array.isArray(req.body.inclusions) ? req.body.inclusions.map(x => sanitizeString(x, 160)) : [], exclusions: Array.isArray(req.body.exclusions) ? req.body.exclusions.map(x => sanitizeString(x, 160)) : [] };
  if (!trek.name || !trek.difficulty || !trek.duration) return res.status(400).json({ error: 'Missing trek details' });
  db.treks.push(trek); writeDb(db); res.status(201).json(trek);
});
app.put('/api/admin/treks/:id', requireAdmin, (req, res) => { const db = readDb(); const index = db.treks.findIndex(t => t.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Not found' }); db.treks[index] = { ...db.treks[index], ...req.body }; writeDb(db); res.json(db.treks[index]); });
app.delete('/api/admin/treks/:id', requireAdmin, (req, res) => { const db = readDb(); db.treks = db.treks.filter(t => t.id !== req.params.id); writeDb(db); res.json({ ok: true }); });
app.post('/api/admin/batches', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = { id: sanitizeString(req.body.id || id('B'), 40), trek: sanitizeString(req.body.trek, 120), note: sanitizeString(req.body.note || 'Admin added batch', 160), date: sanitizeString(req.body.date, 80), price: Math.max(100, Number(req.body.price) || 100), seatLimit: Math.max(0, Number(req.body.seatLimit) || 0), available: Boolean(req.body.available) };
  if (!batch.trek || !batch.date) return res.status(400).json({ error: 'Missing batch details' }); db.batches.push(batch); writeDb(db); res.status(201).json(batch);
});
app.put('/api/admin/batches/:id', requireAdmin, (req, res) => { const db = readDb(); const index = db.batches.findIndex(b => b.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Not found' }); db.batches[index] = { ...db.batches[index], ...req.body }; writeDb(db); res.json(db.batches[index]); });
app.delete('/api/admin/batches/:id', requireAdmin, (req, res) => { const db = readDb(); db.batches = db.batches.filter(b => b.id !== req.params.id); writeDb(db); res.json({ ok: true }); });
app.patch('/api/admin/bookings/:bookingId/status', requireAdmin, (req, res) => { const db = readDb(); const booking = db.bookings.find(b => b.bookingId === req.params.bookingId); if (!booking) return res.status(404).json({ error: 'Booking not found' }); booking.paymentStatus = sanitizeString(req.body.paymentStatus || booking.paymentStatus, 80); booking.updatedAt = new Date().toISOString(); writeDb(db); res.json(booking); });
app.patch('/api/admin/gallery/:id/status', requireAdmin, (req, res) => { const db = readDb(); const item = db.gallerySubmissions.find(g => g.id === req.params.id); if (!item) return res.status(404).json({ error: 'Gallery photo not found' }); const status = sanitizeString(req.body.status, 20); if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: 'Invalid status' }); item.status = status; item.reviewedAt = new Date().toISOString(); if (status === 'approved') item.approvedAt = item.reviewedAt; writeDb(db); res.json(item); });

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));
app.get('/admin.html', adminPageGuard, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.use(express.static(__dirname, { extensions: ['html'], setHeaders: (res, filePath) => { if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) res.setHeader('Cache-Control', 'no-store'); } }));
app.use((req, res) => res.status(404).send('Page not found'));
app.listen(PORT, () => {
  console.log(`The Green Trekkers secure server running on http://localhost:${PORT}`);
  console.log(`Admin login page: http://localhost:${PORT}/admin-login.html`);
});

