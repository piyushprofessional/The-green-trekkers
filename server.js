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


const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.warn('SECURITY WARNING: Set JWT_SECRET in .env with at least 32 random characters before using this for business.');
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
  console.warn('SECURITY WARNING: Set ADMIN_EMAIL and a strong ADMIN_PASSWORD in .env before using this for business.');
}

const tokenSecret = JWT_SECRET || 'LOCAL_ONLY_CHANGE_THIS_SECRET_BEFORE_DEPLOYMENT_1234567890';

function parseCouponConfig(value) {
  const fallback = 'HAPPYGREEN10:10,HAPPYGREEN20:20,HAPPYGREEN50:50,HAPPYGREEN100:100';
  return String(value || fallback)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .reduce((map, item) => {
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
function findBatch(db, trek, date) {
  const cleanTrek = sanitizeString(trek, 120);
  const cleanDate = sanitizeString(date, 80);
  return db.batches.find(batch => batch.trek === cleanTrek && batch.date === cleanDate) || null;
}

const ALLOWED_TREK = 'Harishchandragad Trek';
const ALLOWED_DATE = '04 July 2026, 11:00 PM';
const ALLOWED_PRICE = 1199;
const ALLOWED_PICKUPS = ['Moshi', 'Chakan'];

const defaultBatches = [
  { id: 'B-RAJ-01', trek: 'Rajmachi Fort Trek', note: 'Night trail + fireflies', date: 'Coming Soon', price: 1299, available: false },
  { id: 'B-KAL-01', trek: 'Kalsubai Peak Trek', note: 'Highest peak of Maharashtra', date: 'Coming Soon', price: 1599, available: false },
  { id: 'B-DEV-01', trek: 'Devkund Waterfall Trek', note: 'Forest walk + waterfall', date: 'Coming Soon', price: 1499, available: false },
  { id: 'B-HAR-01', trek: ALLOWED_TREK, note: 'Konkan Kada sunrise batch', date: ALLOWED_DATE, price: ALLOWED_PRICE, available: true },
  { id: 'B-SAN-01', trek: 'Sandhan Valley Trek', note: 'Camping + adventure trail', date: 'Coming Soon', price: 2999, available: false },
  { id: 'B-AND-01', trek: 'Andharban Jungle Trek', note: 'Mist, forest + waterfall trail', date: 'Coming Soon', price: 1799, available: false }
];

const defaultTreks = [
  { id: 'T-RAJ', name: 'Rajmachi Fort Trek', difficulty: 'Beginner', duration: '1 Day / 1 Night', description: 'Night trail near Lonavala with fireflies and forest route.', available: false },
  { id: 'T-KAL', name: 'Kalsubai Peak Trek', difficulty: 'Moderate', duration: '1 Day', description: "Maharashtra's highest peak with sunrise views.", available: false },
  { id: 'T-DEV', name: 'Devkund Waterfall Trek', difficulty: 'Beginner', duration: '1 Day', description: 'Jungle trail ending at a waterfall.', available: false },
  { id: 'T-HAR', name: ALLOWED_TREK, difficulty: 'Difficult', duration: '1 Day / 1 Night', description: 'Konkan Kada, caves and sunrise route. Fixed batch starts on 04 July at 11:00 PM.', available: true },
  { id: 'T-SAN', name: 'Sandhan Valley Trek', difficulty: 'Adventure', duration: '2 Days', description: 'Camping, valley route and adventure patches.', available: false },
  { id: 'T-AND', name: 'Andharban Jungle Trek', difficulty: 'Moderate', duration: '1 Day', description: 'Descending forest trek with mist and waterfalls.', available: false }
];

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ users: [], treks: defaultTreks, batches: defaultBatches, bookings: [] }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  if (!Array.isArray(db.users)) db.users = [];
  // Keep all treks visible, but only Harishchandragad is available for booking.
  db.treks = defaultTreks;
  db.batches = defaultBatches;
  if (!Array.isArray(db.bookings)) db.bookings = [];
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDb(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }
function id(prefix) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`; }
function safeUser(user) { return { id: user.id, name: user.name, email: user.email, phone: user.phone || '', role: user.role || 'user', authProvider: user.authProvider || 'email' }; }
function sanitizeString(value, max = 200) { return String(value || '').trim().slice(0, max); }
function isEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '')); }
function isPhone(value) { return /^[0-9]{10}$/.test(String(value || '')); }

function signToken(payload) {
  return jwt.sign(payload, tokenSecret, { expiresIn: '8h', issuer: 'green-trekkers' });
}
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000
  };
}
function clearCookieOptions() {
  return { httpOnly: true, sameSite: 'lax', secure: NODE_ENV === 'production' };
}
function getToken(req) {
  return req.cookies.gt_session || '';
}
function getAuth(req) {
  const token = getToken(req);
  if (!token) return null;
  try { return jwt.verify(token, tokenSecret, { issuer: 'green-trekkers' }); }
  catch { return null; }
}
function requireAuth(req, res, next) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ error: 'Login required' });
  req.auth = auth;
  next();
}
function requireAdmin(req, res, next) {
  const auth = getAuth(req);
  if (!auth || auth.role !== 'admin') return res.status(403).json({ error: 'Admin access denied' });
  req.auth = auth;
  next();
}
function adminPageGuard(req, res, next) {
  const auth = getAuth(req);
  if (!auth || auth.role !== 'admin') return res.redirect('/admin-login.html');
  next();
}

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Allows local testing from VS Code Live Server / file preview during development.
// Recommended usage is still: npm start, then open http://localhost:5000
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isLocalOrigin = origin === 'null' || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');

  if (NODE_ENV !== 'production' && origin && isLocalOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' }
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 250,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'The Green Trekkers Secure API' }));
app.get('/api/me', (req, res) => {
  const auth = getAuth(req);
  res.json({ user: auth ? { id: auth.id, name: auth.name, email: auth.email, role: auth.role } : null });
});

app.post('/api/signup', loginLimiter, async (req, res) => {
  const db = readDb();
  const name = sanitizeString(req.body.name, 80);
  const email = sanitizeString(req.body.email, 120).toLowerCase();
  const phone = sanitizeString(req.body.phone, 10);
  const password = String(req.body.password || '');

  if (name.length < 3) return res.status(400).json({ error: 'Full name is required' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Valid email is required' });
  if (!isPhone(phone)) return res.status(400).json({ error: 'Valid 10 digit phone number is required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  if (db.users.some(u => String(u.email).toLowerCase() === email)) return res.status(409).json({ error: 'User already exists' });

  const user = { id: id('U'), name, email, phone, passwordHash: await bcrypt.hash(password, 12), role: 'user', createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDb(db);

  const publicUser = safeUser(user);
  res.cookie('gt_session', signToken(publicUser), cookieOptions());
  res.status(201).json({ user: publicUser });
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const email = sanitizeString(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  const db = readDb();
  const user = db.users.find(u => String(u.email).toLowerCase() === email);
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const publicUser = safeUser(user);
  res.cookie('gt_session', signToken(publicUser), cookieOptions());
  res.json({ user: publicUser });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('gt_session', clearCookieOptions());
  res.json({ ok: true });
});

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const email = sanitizeString(req.body.email, 120).toLowerCase();
  const password = String(req.body.password || '');
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return res.status(500).json({ error: 'Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.' });
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Invalid admin login' });

  const adminUser = { id: 'admin', name: 'Admin', email: ADMIN_EMAIL, role: 'admin' };
  res.cookie('gt_session', signToken(adminUser), cookieOptions());
  res.json({ user: adminUser });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('gt_session', clearCookieOptions());
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  const auth = getAuth(req);
  if (!auth || auth.role !== 'admin') return res.status(401).json({ admin: null });
  res.json({ admin: { id: auth.id, name: auth.name, email: auth.email, role: auth.role } });
});

app.get('/api/treks', (req, res) => res.json(readDb().treks));
app.get('/api/batches', (req, res) => res.json(readDb().batches));

app.post('/api/coupons/validate', requireAuth, (req, res) => {
  const subtotal = Math.max(0, Number(req.body.subtotal) || 0);
  const result = calculateDiscount(req.body.couponCode, subtotal);
  if (!result) return res.status(400).json({ error: 'Invalid coupon code.' });
  res.json(result);
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const db = readDb();
  const trek = sanitizeString(req.body.trek, 120);
  const date = sanitizeString(req.body.date, 80);
  if (trek !== ALLOWED_TREK || date !== ALLOWED_DATE) {
    return res.status(400).json({ error: 'Only Harishchandragad Trek on 04 July 2026 at 11:00 PM is open for booking.' });
  }
  const batch = findBatch(db, trek, date);
  const members = Math.max(1, Math.min(Number(req.body.members) || 1, 20));
  const amount = batch ? Math.max(0, Number(batch.price) || 0) : Math.max(0, Number(req.body.amount) || 0);
  const subtotal = amount * members;
  const discountResult = calculateDiscount(req.body.couponCode, subtotal);

  if (!discountResult) return res.status(400).json({ error: 'Invalid coupon code.' });

  const paymentModeFromClient = sanitizeString(req.body.paymentMode, 80);
  const paymentStatusFromClient = sanitizeString(req.body.paymentStatus || 'Payment Pending', 80);
  const booking = {
    bookingId: sanitizeString(req.body.bookingId || id('GT'), 40),
    trek,
    date,
    price: amount ? `₹${amount}` : sanitizeString(req.body.price, 40),
    members,
    amount,
    subtotal,
    couponCode: discountResult.couponCode,
    couponPercent: discountResult.couponPercent,
    discountAmount: discountResult.discountAmount,
    total: discountResult.total,
    customerName: sanitizeString(req.body.customerName, 80),
    email: req.auth.email || '',
    phone: sanitizeString(req.body.phone, 10),
    pickup: sanitizeString(req.body.pickup, 120),
    dropPoint: sanitizeString(req.body.dropPoint, 120),
    paymentMode: discountResult.total === 0 ? 'Coupon / Free Booking' : paymentModeFromClient,
    paymentStatus: discountResult.total === 0 ? 'Coupon Free Booking' : paymentStatusFromClient,
    paymentScreenshot: sanitizeString(req.body.paymentScreenshot, 160),
    bookedAt: new Date().toISOString(),
    userId: req.auth.id
  };
  if (!booking.trek || !booking.date || !booking.customerName || !isPhone(booking.phone)) {
    return res.status(400).json({ error: 'Missing or invalid booking details' });
  }
  if (!ALLOWED_PICKUPS.includes(booking.pickup)) {
    return res.status(400).json({ error: 'Pickup point must be Moshi or Chakan.' });
  }
  if (!ALLOWED_PICKUPS.includes(booking.dropPoint)) {
    return res.status(400).json({ error: 'Drop point must be Moshi or Chakan.' });
  }
  if (booking.total > 0 && !booking.paymentMode) {
    return res.status(400).json({ error: 'Payment status is required.' });
  }
  db.bookings.push(booking);
  writeDb(db);
  res.status(201).json(booking);
});

app.post('/api/send-confirmation', requireAuth, async (req, res) => {
  const booking = req.body.booking;
  if (!booking) return res.status(400).json({ error: 'Booking required' });
  const subject = `The Green Trekkers Booking ${sanitizeString(booking.bookingId, 40)}`;
  const text = `Hello ${sanitizeString(booking.customerName, 80)},\n\nYour trek booking has been received.\nBooking ID: ${sanitizeString(booking.bookingId, 40)}\nTrek: ${sanitizeString(booking.trek, 120)}\nDate: ${sanitizeString(booking.date, 80)}\nSubtotal: Rs. ${Number(booking.subtotal || booking.total || 0)}\nCoupon: ${sanitizeString(booking.couponCode || 'Not applied', 40)}\nDiscount: Rs. ${Number(booking.discountAmount || 0)}\nTotal: Rs. ${Number(booking.total || 0)}\nPayment Status: ${sanitizeString(booking.paymentStatus, 80)}\n\nSupport: thegreentrekkers5@gmail.com\nWhatsApp Channel: https://whatsapp.com/channel/0029Vb8vXbYDjiOiMpjSqh1X\nInstagram: https://www.instagram.com/the_green_trekkers?igsh=MTM0dnI0cDhzcHhn`;

  if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: req.auth.email, subject, text });
    return res.json({ sent: true });
  }
  console.log('\n--- EMAIL CONFIRMATION DEMO ---');
  console.log(subject); console.log(text); console.log('Set SMTP_HOST, SMTP_USER, SMTP_PASS to send real email.');
  res.json({ sent: false, demo: true, message: 'Email printed in server console because SMTP is not configured.' });
});

app.get('/api/admin/dashboard', requireAdmin, (req, res) => res.json(readDb()));
app.post('/api/admin/treks', requireAdmin, (req, res) => {
  const db = readDb();
  const trek = {
    id: sanitizeString(req.body.id || id('T'), 40),
    name: sanitizeString(req.body.name, 120),
    difficulty: sanitizeString(req.body.difficulty, 40),
    duration: sanitizeString(req.body.duration, 60),
    description: sanitizeString(req.body.description, 300)
  };
  if (!trek.name || !trek.difficulty || !trek.duration) return res.status(400).json({ error: 'Missing trek details' });
  db.treks.push(trek);
  writeDb(db);
  res.status(201).json(trek);
});
app.put('/api/admin/treks/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const index = db.treks.findIndex(t => t.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Not found' });
  db.treks[index] = { ...db.treks[index], ...req.body };
  writeDb(db);
  res.json(db.treks[index]);
});
app.delete('/api/admin/treks/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.treks = db.treks.filter(t => t.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});
app.post('/api/admin/batches', requireAdmin, (req, res) => {
  const db = readDb();
  const batch = {
    id: sanitizeString(req.body.id || id('B'), 40),
    trek: sanitizeString(req.body.trek, 120),
    note: sanitizeString(req.body.note || 'Admin added batch', 160),
    date: sanitizeString(req.body.date, 80),
    price: Math.max(100, Number(req.body.price) || 100)
  };
  if (!batch.trek || !batch.date) return res.status(400).json({ error: 'Missing batch details' });
  db.batches.push(batch);
  writeDb(db);
  res.status(201).json(batch);
});
app.put('/api/admin/batches/:id', requireAdmin, (req, res) => {
  const db = readDb();
  const index = db.batches.findIndex(b => b.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Not found' });
  db.batches[index] = { ...db.batches[index], ...req.body };
  writeDb(db);
  res.json(db.batches[index]);
});
app.delete('/api/admin/batches/:id', requireAdmin, (req, res) => {
  const db = readDb();
  db.batches = db.batches.filter(b => b.id !== req.params.id);
  writeDb(db);
  res.json({ ok: true });
});
app.patch('/api/admin/bookings/:bookingId/status', requireAdmin, (req, res) => {
  const db = readDb();
  const booking = db.bookings.find(b => b.bookingId === req.params.bookingId);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  booking.paymentStatus = sanitizeString(req.body.paymentStatus || booking.paymentStatus, 80);
  booking.updatedAt = new Date().toISOString();
  writeDb(db);
  res.json(booking);
});

// Always return JSON for missing API routes so the frontend shows a clear message.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `API 404: ${req.method} ${req.originalUrl} was not found. Start the backend with npm start and open http://localhost:${PORT}`
  });
});

app.get('/admin.html', adminPageGuard, (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.use(express.static(__dirname, {
  dotfiles: 'ignore',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  }
}));

app.use((req, res) => res.status(404).send('Page not found'));

app.listen(PORT, () => {
  ensureDb();
  console.log(`The Green Trekkers secure server running on http://localhost:${PORT}`);
  console.log('Admin login page: http://localhost:' + PORT + '/admin-login.html');
});

