
// The Green Trekkers - complete website interactions + admin + backend sync
(function () {
  "use strict";

  const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const whatsappNumber = "";
  const whatsappChannelLink = "https://whatsapp.com/channel/0029Vb8vXbYDjiOiMpjSqh1X";
  const instagramLink = "https://www.instagram.com/the_green_trekkers?igsh=MTM0dnI0cDhzcHhn";
  const businessEmail = "thegreentrekkers5@gmail.com";
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const protectedPages = ["treks.html", "batches.html", "gallery.html", "locations.html", "policy.html"];
  const API_BASE = (() => {
    const host = window.location.hostname;
    const port = window.location.port;
    const isFile = window.location.protocol === "file:";
    const isLocalhost = host === "localhost" || host === "127.0.0.1";

    // Best setup: open http://localhost:5000 after running npm start.
    // If you accidentally use VS Code Live Server like http://127.0.0.1:5500,
    // this will still send API calls to the Node backend on port 5000.
    if (isFile || (isLocalhost && port && port !== "5000")) return "http://localhost:5000";
    return "";
  })();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function showMessage(element, text, isError) {
    if (!element) return;
    element.textContent = text || "";
    element.classList.toggle("error", Boolean(isError));
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

  async function apiFetch(path, options = {}) {
    let response;

    try {
      response = await fetch(API_BASE + path, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });
    } catch (error) {
      throw new Error("Backend is not connected. First run npm install and npm start, then open http://localhost:5000");
    }

    let data = null;
    try { data = await response.json(); } catch (_) {}

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error((data && data.error) || "API 404: backend route not found. Run npm start and open http://localhost:5000, not Live Server/file mode.");
      }
      throw new Error((data && data.error) || ("API error " + response.status));
    }

    return data;
  }

  const defaultBatches = [
    { id: "B-RAJ-01", trek: "Rajmachi Fort Trek", note: "Night trail + fireflies", date: "Coming Soon", price: 1299, available: false },
    { id: "B-KAL-01", trek: "Kalsubai Peak Trek", note: "Highest peak of Maharashtra", date: "Coming Soon", price: 1599, available: false },
    { id: "B-DEV-01", trek: "Devkund Waterfall Trek", note: "Forest walk + waterfall", date: "Coming Soon", price: 1499, available: false },
    { id: "B-HAR-01", trek: "Harishchandragad Trek", note: "Konkan Kada sunrise batch", date: "04 July 2026, 11:00 PM", price: 1199, available: true },
    { id: "B-SAN-01", trek: "Sandhan Valley Trek", note: "Camping + adventure trail", date: "Coming Soon", price: 2999, available: false },
    { id: "B-AND-01", trek: "Andharban Jungle Trek", note: "Mist, forest + waterfall trail", date: "Coming Soon", price: 1799, available: false }
  ];

  const defaultTreks = [
    { id: "T-RAJ", name: "Rajmachi Fort Trek", difficulty: "Beginner", duration: "1 Day / 1 Night", description: "Night trail near Lonavala with fireflies and forest route.", available: false },
    { id: "T-KAL", name: "Kalsubai Peak Trek", difficulty: "Moderate", duration: "1 Day", description: "Maharashtra's highest peak with sunrise views.", available: false },
    { id: "T-DEV", name: "Devkund Waterfall Trek", difficulty: "Beginner", duration: "1 Day", description: "Jungle trail ending at a waterfall.", available: false },
    { id: "T-HAR", name: "Harishchandragad Trek", difficulty: "Difficult", duration: "1 Day / 1 Night", description: "Konkan Kada, caves and sunrise route. Fixed batch starts on 04 July at 11:00 PM.", available: true },
    { id: "T-SAN", name: "Sandhan Valley Trek", difficulty: "Adventure", duration: "2 Days", description: "Camping, valley route and adventure patches.", available: false },
    { id: "T-AND", name: "Andharban Jungle Trek", difficulty: "Moderate", duration: "1 Day", description: "Descending forest trek with mist and waterfalls.", available: false }
  ];

  // Keep all trek options visible, but only Harishchandragad is available for booking.
  writeJSON("greenTrekkersBatches", defaultBatches);
  writeJSON("greenTrekkersTreks", defaultTreks);

  // Theme / dark mode
  const root = document.documentElement;
  const themeToggle = $("#themeToggle");
  function applyTheme(theme) {
    const safeTheme = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", safeTheme);
    localStorage.setItem("greenTrekkersTheme", safeTheme);
    if (themeToggle) {
      themeToggle.textContent = safeTheme === "dark" ? "☀️ Light" : "🌙 Dark";
      themeToggle.setAttribute("aria-label", safeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }
  applyTheme(localStorage.getItem("greenTrekkersTheme") || "light");
  if (themeToggle) themeToggle.addEventListener("click", () => applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark"));

  // Navigation and active page
  $$(".site-nav a[data-page]").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href.toLowerCase() === currentPage) link.classList.add("active");
  });

  const storedUser = localStorage.getItem("greenTrekkersUser");
  if (protectedPages.includes(currentPage) && !storedUser) {
    window.location.href = "index.html";
    return;
  }

  const userBadge = $("#userBadge");
  if (userBadge && storedUser) {
    try { const user = JSON.parse(storedUser); userBadge.textContent = "Hi, " + ((user.name || user.username || "Trekker").split(" ")[0]); }
    catch { userBadge.textContent = "Hi, Trekker"; }
  }
  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", async () => {
    try { await apiFetch("/api/logout", { method: "POST" }); } catch (_) {}
    localStorage.removeItem("greenTrekkersUser");
    window.location.href = "index.html";
  });

  const navToggle = $("#navToggle"), siteNav = $("#siteNav");
  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    $$("a", siteNav).forEach(link => link.addEventListener("click", () => { siteNav.classList.remove("open"); navToggle.setAttribute("aria-expanded", "false"); }));
  }
  const siteHeader = $("#siteHeader");
  if (siteHeader) {
    const updateHeader = () => siteHeader.classList.toggle("scrolled", window.scrollY > 18);
    updateHeader(); window.addEventListener("scroll", updateHeader);
  }

  // Reveal animations
  const revealElements = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); } });
    }, { threshold: 0.12 });
    revealElements.forEach(item => observer.observe(item));
  } else revealElements.forEach(item => item.classList.add("visible"));

  // Login / Signup
  $$(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.authTab;
      $$(".auth-tab").forEach(t => t.classList.toggle("active", t === tab));
      $$(".auth-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.authPanel === name));
    });
  });

  const loginForm = $("#loginForm");
  if (loginForm) loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#loginEmail").value.trim();
    const password = $("#loginPassword").value.trim();
    const msg = $("#loginMessage");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(msg, "Please enter a valid email address.", true);
    if (password.length < 8) return showMessage(msg, "Password must be at least 8 characters.", true);
    try {
      const apiUser = await apiFetch("/api/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (!apiUser || !apiUser.user) throw new Error("Login failed");
      localStorage.setItem("greenTrekkersUser", JSON.stringify(apiUser.user));
      showMessage(msg, "Login successful. Redirecting...", false);
      setTimeout(() => window.location.href = "treks.html", 650);
    } catch (error) {
      showMessage(msg, error.message || "Invalid email or password.", true);
    }
  });

  const signupForm = $("#signupForm");
  if (signupForm) signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim();
    const phone = $("#signupPhone").value.trim();
    const password = $("#signupPassword").value.trim();
    const msg = $("#signupMessage");
    if (name.length < 3) return showMessage(msg, "Please enter your full name.", true);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(msg, "Please enter a valid email address.", true);
    if (!/^[0-9]{10}$/.test(phone)) return showMessage(msg, "Please enter a valid 10 digit phone number.", true);
    if (password.length < 8) return showMessage(msg, "Password must be at least 8 characters.", true);
    try {
      const apiUser = await apiFetch("/api/signup", { method: "POST", body: JSON.stringify({ name, email, phone, password }) });
      if (!apiUser || !apiUser.user) throw new Error("Signup failed");
      localStorage.setItem("greenTrekkersUser", JSON.stringify(apiUser.user));
      showMessage(msg, "Signup successful. Redirecting...", false);
      setTimeout(() => window.location.href = "treks.html", 700);
    } catch (error) {
      showMessage(msg, error.message || "Signup failed. Please try again.", true);
    }
  });

  // Secure admin login page
  const secureAdminLoginForm = $("#secureAdminLoginForm");
  if (secureAdminLoginForm) secureAdminLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#secureAdminEmail").value.trim();
    const password = $("#secureAdminPassword").value.trim();
    const msg = $("#secureAdminLoginMessage");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(msg, "Please enter a valid admin email.", true);
    if (password.length < 8) return showMessage(msg, "Please enter your admin password.", true);
    try {
      await apiFetch("/api/admin/login", { method: "POST", body: JSON.stringify({ email, password }) });
      showMessage(msg, "Admin login successful. Opening protected panel...", false);
      setTimeout(() => window.location.href = "admin.html", 500);
    } catch (error) {
      showMessage(msg, error.message || "Invalid admin login.", true);
    }
  });

  // Animated counters
  function animateCounter(counter) {
    if (counter.dataset.done === "true") return;
    counter.dataset.done = "true";
    const target = Number(counter.dataset.target || "0");
    const isDecimal = counter.dataset.decimal === "true";
    const duration = 1100;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = Math.round(target * eased);
      counter.textContent = isDecimal ? (value / 10).toFixed(1) : String(value);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const counters = $$(".counter");
  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { animateCounter(entry.target); counterObserver.unobserve(entry.target); } }), { threshold: 0.4 });
      counters.forEach(counter => counterObserver.observe(counter));
    } else counters.forEach(animateCounter);
  }

  // Booking page
  const bookingForm = $("#bookingForm");
  const selectedTrek = $("#selectedTrek"), selectedDate = $("#selectedDate"), selectedPrice = $("#selectedPrice"), selectedAmount = $("#selectedAmount"), membersInput = $("#members"), totalAmount = $("#totalAmount"), couponCodeInput = $("#couponCode"), applyCouponBtn = $("#applyCouponBtn"), couponMessage = $("#couponMessage"), bookingMessage = $("#bookingMessage"), confirmationBox = $("#confirmationBox"), confirmationText = $("#confirmationText"), newBookingBtn = $("#newBookingBtn"), paymentScreenshot = $("#paymentScreenshot"), screenshotName = $("#screenshotName"), bookingIdInput = $("#bookingId"), whatsappBtn = $("#whatsappBtn"), downloadTicketBtn = $("#downloadTicketBtn");
  let appliedCoupon = { code: "", percent: 0 };
  let lastConfirmedBooking = null;

  const summaryFields = {
    bookingId: $("#summaryBookingId"), name: $("#summaryName"), trek: $("#summaryTrek"), date: $("#summaryDate"), members: $("#summaryMembers"), payment: $("#summaryPayment"), pickup: $("#summaryPickup"), dropPoint: $("#summaryDropPoint"), coupon: $("#summaryCoupon"), discount: $("#summaryDiscount"), total: $("#summaryTotal"), screenshot: $("#summaryScreenshot"), paymentStatus: $("#summaryPaymentStatus")
  };

  function parseAmount(priceText) { return Number(String(priceText || "").replace(/[^0-9]/g, "")) || 0; }
  function generateBookingId() { return "GT-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000); }
  function getCustomerName() { const input = $("#customerName"); return input ? input.value.trim() : ""; }
  function getPhone() { const input = $("#phone"); return input ? input.value.trim() : ""; }
  function getPickup() { const input = $("#pickup"); return input ? input.value : ""; }
  function getDropPoint() { const input = $("#dropPoint"); return input ? input.value : ""; }
  function getPaymentMode() { const input = $("#paymentMode"); return input ? input.value : ""; }
  function getScreenshotFileName() { return paymentScreenshot && paymentScreenshot.files && paymentScreenshot.files.length ? paymentScreenshot.files[0].name : ""; }
  function statusFromMode(mode, screenshot, finalTotal) {
    if (Number(finalTotal) === 0) return "Coupon Free Booking";
    if (mode === "UPI Payment Done" && screenshot) return "Payment Under Review";
    if (mode === "Will Pay Later") return "Payment Pending";
    if (mode === "Coupon / Free Booking") return "Coupon Free Booking";
    return "Pending";
  }

  function normalizeCoupon(code) { return String(code || "").trim().toUpperCase().replace(/\s+/g, ""); }

  function getBookingTotals() {
    const baseAmount = Number(selectedAmount && selectedAmount.value) || parseAmount(selectedPrice && selectedPrice.value);
    const members = Number(membersInput && membersInput.value) || 1;
    const subtotal = baseAmount * members;
    const discount = Math.round(subtotal * (Number(appliedCoupon.percent) || 0) / 100);
    const finalTotal = Math.max(0, subtotal - discount);
    return { baseAmount, members, subtotal, discount, finalTotal };
  }

  async function applyCoupon(showStatus = true) {
    const code = normalizeCoupon(couponCodeInput && couponCodeInput.value);
    if (!couponCodeInput || !code) {
      appliedCoupon = { code: "", percent: 0 };
      if (showStatus) showMessage(couponMessage, "", false);
      updateTotal();
      return true;
    }

    const baseAmount = Number(selectedAmount && selectedAmount.value) || parseAmount(selectedPrice && selectedPrice.value);
    const members = Number(membersInput && membersInput.value) || 1;
    const subtotal = baseAmount * members;

    try {
      const result = await apiFetch("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ couponCode: code, subtotal })
      });
      appliedCoupon = { code: result.couponCode || code, percent: Number(result.couponPercent) || 0 };
      couponCodeInput.value = appliedCoupon.code;
      if (showStatus) showMessage(couponMessage, "Private discount applied.", false);
      updateTotal();
      return true;
    } catch (error) {
      appliedCoupon = { code: "", percent: 0 };
      if (showStatus) showMessage(couponMessage, "Invalid private discount link.", true);
      updateTotal();
      return false;
    }
  }

  function updateSummary() {
    if (!bookingForm) return;
    const totals = getBookingTotals();
    const members = totals.members;
    const screenshot = getScreenshotFileName();
    if (summaryFields.bookingId) summaryFields.bookingId.textContent = bookingIdInput.value || "GT-0000";
    if (summaryFields.name) summaryFields.name.textContent = getCustomerName() || "Not entered";
    if (summaryFields.trek) summaryFields.trek.textContent = selectedTrek.value.trim() || "Not selected";
    if (summaryFields.date) summaryFields.date.textContent = selectedDate.value.trim() || "Not selected";
    if (summaryFields.members) summaryFields.members.textContent = String(members);
    if (summaryFields.payment) summaryFields.payment.textContent = getPaymentMode() || "Not selected";
    if (summaryFields.coupon) summaryFields.coupon.textContent = appliedCoupon.code ? appliedCoupon.code + " (" + appliedCoupon.percent + "%)" : "Not applied";
    if (summaryFields.discount) summaryFields.discount.textContent = rupee.format(totals.discount);
    if (summaryFields.total) summaryFields.total.textContent = rupee.format(totals.finalTotal);
    if (summaryFields.screenshot) summaryFields.screenshot.textContent = screenshot || "Not uploaded";
    if (summaryFields.paymentStatus) summaryFields.paymentStatus.textContent = statusFromMode(getPaymentMode(), screenshot, totals.finalTotal);
  }

  function updateTotal() {
    if (!membersInput || !totalAmount) return;
    const totals = getBookingTotals();
    totalAmount.textContent = appliedCoupon.percent
      ? rupee.format(totals.finalTotal) + " after private discount"
      : rupee.format(totals.finalTotal);
    updateSummary();
  }

  function fillBooking(trek, date, price, amount) {
    if (!selectedTrek || !selectedDate || !selectedPrice || !selectedAmount) return;
    selectedTrek.value = trek || ""; selectedDate.value = date || ""; selectedPrice.value = price || ""; selectedAmount.value = amount || parseAmount(price);
    updateTotal();
    if (couponCodeInput && couponCodeInput.value.trim()) applyCoupon(false);
    if (bookingForm) bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function getAvailableBatches() {
    let batches = readJSON("greenTrekkersBatches", defaultBatches);
    try {
      const apiBatches = await apiFetch("/api/batches");
      if (Array.isArray(apiBatches) && apiBatches.length) {
        batches = apiBatches;
        writeJSON("greenTrekkersBatches", batches);
      }
    } catch (_) {}
    return batches;
  }

  function bindBookButtons() {
    $$(".book-btn").forEach(button => {
      if (button.dataset.bound === "true") return;
      button.dataset.bound = "true";
      button.addEventListener("click", () => {
        if (button.disabled || button.dataset.available === "false") {
          showMessage($("#bookingMessage"), "This trek is currently unavailable. Only Harishchandragad Trek is open for booking.", true);
          return;
        }
        fillBooking(button.dataset.trek, button.dataset.date, button.dataset.price, button.dataset.amount);
      });
    });
  }

  async function renderDynamicBatches() {
    const tableBody = $("#batchTableBody");
    if (!tableBody) return;
    const dynamic = await getAvailableBatches();
    tableBody.innerHTML = "";
    dynamic.forEach(batch => {
      const isAvailable = batch.available !== false && batch.trek === "Harishchandragad Trek" && batch.date === "04 July 2026, 11:00 PM";
      const tr = document.createElement("tr");
      tr.dataset.batchRow = batch.id;
      tr.className = isAvailable ? "" : "unavailable-row";
      const dateText = isAvailable ? batch.date : "Coming Soon";
      const actionHtml = isAvailable
        ? `<button class="book-btn" data-available="true" data-trek="${batch.trek}" data-date="${dateText}" data-price="${rupee.format(Number(batch.price))}" data-amount="${Number(batch.price)}">Book Now</button>`
        : `<button class="book-btn unavailable-btn" type="button" data-available="false" disabled>Unavailable</button>`;
      tr.innerHTML = `<td><strong>${batch.trek}</strong><span>${batch.note || "Trek option"}</span></td><td>${dateText}</td><td>${isAvailable ? rupee.format(Number(batch.price)) : "—"}</td><td>${actionHtml}</td>`;
      tableBody.appendChild(tr);
    });
    bindBookButtons();
  }

  if (bookingIdInput && !bookingIdInput.value) bookingIdInput.value = generateBookingId();
  if (couponCodeInput) {
    const privateCouponFromUrl = normalizeCoupon(new URLSearchParams(window.location.search).get("coupon"));
    if (privateCouponFromUrl) couponCodeInput.value = privateCouponFromUrl;
  }
  renderDynamicBatches();
  bindBookButtons();
  if (membersInput) { membersInput.addEventListener("input", updateTotal); membersInput.addEventListener("change", updateTotal); }
  if (selectedPrice) selectedPrice.addEventListener("input", () => { if (selectedAmount) selectedAmount.value = parseAmount(selectedPrice.value); updateTotal(); });
  if (applyCouponBtn) applyCouponBtn.addEventListener("click", () => { applyCoupon(true); });
  if (couponCodeInput) {
    couponCodeInput.addEventListener("input", () => {
      if (!couponCodeInput.value.trim()) { appliedCoupon = { code: "", percent: 0 }; showMessage(couponMessage, "", false); updateTotal(); }
    });
    couponCodeInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(true); } });
  }
  [selectedTrek, selectedDate, $("#customerName"), $("#phone"), $("#pickup"), $("#dropPoint"), $("#paymentMode")].filter(Boolean).forEach(field => { field.addEventListener("input", updateSummary); field.addEventListener("change", updateSummary); });
  if (paymentScreenshot) paymentScreenshot.addEventListener("change", () => { const fileName = getScreenshotFileName(); if (screenshotName) screenshotName.textContent = fileName ? "Uploaded: " + fileName : "Optional for 'Will Pay Later'. Required after UPI payment."; updateSummary(); });

  if (currentPage === "batches.html") {
    const params = new URLSearchParams(window.location.search);
    const trekFromUrl = params.get("trek");
    getAvailableBatches().then(batches => {
      const batch = batches.find(b => b.trek === "Harishchandragad Trek") || defaultBatches[0];
      setTimeout(() => fillBooking(batch.trek, batch.date, rupee.format(Number(batch.price)), batch.price), 250);
      updateTotal(); updateSummary();
      if (couponCodeInput && couponCodeInput.value.trim()) setTimeout(() => applyCoupon(false), 450);
    });
  }

  function buildWhatsappMessage(booking) {
    return ["Hello The Green Trekkers, I want to confirm my trek booking.", "", "Booking ID: " + booking.bookingId, "Name: " + booking.customerName, "Phone: " + booking.phone, "Trek: " + booking.trek, "Batch Date: " + booking.date, "Members: " + booking.members, "Price Per Person: " + booking.price, "Total Amount: " + rupee.format(booking.total), "Pickup Point: " + booking.pickup, "Drop Point: " + (booking.dropPoint || "Not selected"), "Payment Mode: " + booking.paymentMode, "Payment Status: " + booking.paymentStatus, "Payment Screenshot: " + (booking.paymentScreenshot || "Not uploaded")].join("\n");
  }

  if (bookingForm) bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (couponCodeInput && couponCodeInput.value.trim()) {
      const couponOk = await applyCoupon(false);
      if (!couponOk) return showMessage(bookingMessage, "Private discount link is invalid or expired.", true);
    }
    const trek = selectedTrek.value.trim(), date = selectedDate.value.trim(), price = selectedPrice.value.trim(), customerName = getCustomerName(), phone = getPhone(), pickup = getPickup(), dropPoint = getDropPoint(), paymentMode = getPaymentMode(), paymentScreenshotName = getScreenshotFileName(), bookingId = bookingIdInput.value || generateBookingId();
    const totals = getBookingTotals();
    const members = totals.members, amount = totals.baseAmount, total = totals.finalTotal;
    if (!trek || !date || !price) return showMessage(bookingMessage, "Please select a trek batch first.", true);
    if (customerName.length < 3) return showMessage(bookingMessage, "Please enter your full name.", true);
    if (!/^[0-9]{10}$/.test(phone)) return showMessage(bookingMessage, "Please enter a valid 10 digit phone number.", true);
    if (!pickup) return showMessage(bookingMessage, "Please select a pickup point.", true);
    if (!["Moshi", "Chakan"].includes(pickup)) return showMessage(bookingMessage, "Pickup point must be Moshi or Chakan.", true);
    if (total > 0 && !paymentMode) return showMessage(bookingMessage, "Please select payment status after checking the QR payment option.", true);
    if (total > 0 && paymentMode === "UPI Payment Done" && !paymentScreenshotName) return showMessage(bookingMessage, "Please upload your payment screenshot after UPI payment.", true);
    let loggedUser = readJSON("greenTrekkersUser", {});
    const booking = { bookingId, trek, date, price, members, amount, subtotal: totals.subtotal, couponCode: appliedCoupon.code || "", couponPercent: appliedCoupon.percent || 0, discountAmount: totals.discount, total, customerName, email: loggedUser.email || "", phone, pickup, dropPoint, paymentMode: total === 0 ? "Coupon / Free Booking" : paymentMode, paymentStatus: statusFromMode(paymentMode, paymentScreenshotName, total), paymentScreenshot: paymentScreenshotName, bookedAt: new Date().toISOString() };
    try {
      const savedBooking = await apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(booking) });
      Object.assign(booking, savedBooking);
      await apiFetch("/api/send-confirmation", { method: "POST", body: JSON.stringify({ booking }) });
    } catch (error) {
      return showMessage(bookingMessage, error.message || "Booking could not be saved. Please login again and try.", true);
    }
    writeJSON("greenTrekkersLastBooking", booking); lastConfirmedBooking = booking;
    if (confirmationText) confirmationText.innerHTML = `Booking ID: <strong>${bookingId}</strong><br><br>Thank you <strong>${customerName}</strong>! Your booking for <strong>${trek}</strong> on <strong>${date}</strong> is saved.<br><br>Members: <strong>${members}</strong><br>Price Per Person: <strong>${price}</strong><br>Subtotal: <strong>${rupee.format(totals.subtotal)}</strong><br>Discount: <strong>${rupee.format(booking.discountAmount || 0)}</strong><br>Total Amount: <strong>${rupee.format(Number(booking.total || total))}</strong><br>Pickup Point: <strong>${pickup}</strong><br>Drop Point: <strong>${dropPoint}</strong><br>Payment Mode: <strong>${booking.paymentMode}</strong><br>Payment Status: <strong>${booking.paymentStatus}</strong><br>Payment Screenshot: <strong>${paymentScreenshotName || "Not uploaded"}</strong><br>Contact: <strong>${phone}</strong>`;
    if (whatsappBtn) {
      whatsappBtn.href = whatsappNumber
        ? "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(buildWhatsappMessage(booking))
        : whatsappChannelLink;
      whatsappBtn.textContent = whatsappNumber ? "Confirm Booking on WhatsApp" : "Open WhatsApp Channel";
      whatsappBtn.classList.remove("hidden");
    }
    if (downloadTicketBtn) downloadTicketBtn.classList.remove("hidden");
    if (confirmationBox) confirmationBox.classList.remove("hidden");
    showMessage(bookingMessage, "Booking saved successfully! Download ticket or send WhatsApp confirmation.", false);
    updateSummary(); if (confirmationBox) confirmationBox.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  if (newBookingBtn && bookingForm) newBookingBtn.addEventListener("click", () => {
    bookingForm.reset(); appliedCoupon = { code: "", percent: 0 }; if (couponMessage) showMessage(couponMessage, "", false); if (selectedAmount) selectedAmount.value = "0"; if (membersInput) membersInput.value = "1"; if (bookingIdInput) bookingIdInput.value = generateBookingId(); if (whatsappBtn) whatsappBtn.classList.add("hidden"); if (downloadTicketBtn) downloadTicketBtn.classList.add("hidden"); if (screenshotName) screenshotName.textContent = "Optional for 'Will Pay Later'. Required after UPI payment."; updateTotal(); updateSummary(); if (confirmationBox) confirmationBox.classList.add("hidden"); showMessage(bookingMessage, "", false); bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  if (downloadTicketBtn) downloadTicketBtn.addEventListener("click", () => downloadReceiptPdf(lastConfirmedBooking || readJSON("greenTrekkersLastBooking", null)));

  // Simple built-in PDF generator, no external library needed
  function pdfEscape(text) { return String(text ?? "").replace(/[\\()]/g, "\\$&").replace(/₹/g, "Rs."); }
  function downloadReceiptPdf(booking) {
    if (!booking) return alert("Please confirm a booking first.");
    const lines = ["The Green Trekkers - Trek Ticket / Receipt", "", "Booking ID: " + booking.bookingId, "Name: " + booking.customerName, "Phone: " + booking.phone, "Trek: " + booking.trek, "Date: " + booking.date, "Members: " + booking.members, "Subtotal: Rs. " + (booking.subtotal || booking.total), "Discount: Rs. " + (booking.discountAmount || 0), "Total Amount: Rs. " + booking.total, "Pickup Point: " + booking.pickup, "Drop Point: " + (booking.dropPoint || "Not selected"), "Payment Mode: " + booking.paymentMode, "Payment Status: " + booking.paymentStatus, "", "Support: " + businessEmail, "WhatsApp Channel: " + whatsappChannelLink, "Instagram: " + instagramLink, "Note: Carry trekking shoes, water bottle, torch and personal medicines."];
    let textOps = "BT /F1 18 Tf 50 780 Td (" + pdfEscape(lines[0]) + ") Tj ET\n";
    textOps += "BT /F1 12 Tf 50 746 Td 18 TL";
    lines.slice(1).forEach(line => { textOps += " T* (" + pdfEscape(line) + ") Tj"; });
    textOps += " ET";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Length " + textOps.length + " >>\nstream\n" + textOps + "\nendstream"
    ];
    let pdf = "%PDF-1.4\n"; const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += (i+1) + " 0 obj\n" + obj + "\nendobj\n"; });
    const xref = pdf.length; pdf += "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    const blob = new Blob([pdf], { type: "application/pdf" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (booking.bookingId || "trek-ticket") + ".pdf"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  // Gallery
  $$(".filter-btn").forEach(btn => btn.addEventListener("click", () => {
    $$(".filter-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active");
    const filter = btn.dataset.filter;
    $$(".gallery-card").forEach(card => card.classList.toggle("hidden-card", filter !== "all" && card.dataset.category !== filter));
  }));
  const galleryModal = $("#galleryModal"), galleryModalContent = $("#galleryModalContent"), galleryCaption = $("#galleryCaption");
  function openGallery(card) {
    if (!galleryModal || !galleryModalContent) return;
    const img = $("img", card); const emoji = $("div", card);
    galleryModalContent.innerHTML = img ? `<img src="${img.src}" alt="${img.alt || "Gallery preview"}">` : `<div class="emoji-preview">${emoji ? emoji.textContent : "⛰️"}</div>`;
    if (galleryCaption) galleryCaption.textContent = card.dataset.caption || $("span", card)?.textContent || "The Green Trekkers";
    galleryModal.classList.remove("hidden");
  }
  $$(".gallery-card").forEach(card => card.addEventListener("click", () => openGallery(card)));
  const closeGalleryModal = $("#closeGalleryModal");
  if (closeGalleryModal) closeGalleryModal.addEventListener("click", () => galleryModal.classList.add("hidden"));
  if (galleryModal) galleryModal.addEventListener("click", e => { if (e.target === galleryModal) galleryModal.classList.add("hidden"); });
  const galleryUpload = $("#galleryUpload"), uploadedGallery = $("#uploadedGallery");
  if (galleryUpload && uploadedGallery) galleryUpload.addEventListener("change", () => {
    uploadedGallery.innerHTML = "";
    Array.from(galleryUpload.files || []).forEach(file => { const img = document.createElement("img"); img.src = URL.createObjectURL(file); img.alt = file.name; uploadedGallery.appendChild(img); });
  });

  // Admin Panel - protected by backend session cookie
  const adminDashboard = $("#adminDashboard");
  let lastAdminBookings = [];

  async function ensureAdminAccess() {
    if (currentPage !== "admin.html") return false;
    try {
      const data = await apiFetch("/api/admin/me");
      if (!data || !data.admin) throw new Error("Admin login required");
      if (adminDashboard) adminDashboard.classList.remove("hidden");
      await renderAdminData();
      return true;
    } catch (_) {
      window.location.href = "admin-login.html";
      return false;
    }
  }
  if (currentPage === "admin.html") ensureAdminAccess();

  const adminLogoutBtn = $("#adminLogoutBtn");
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", async () => {
    try { await apiFetch("/api/admin/logout", { method: "POST" }); } catch (_) {}
    window.location.href = "admin-login.html";
  });
  const refreshAdminBtn = $("#refreshAdminBtn");
  if (refreshAdminBtn) refreshAdminBtn.addEventListener("click", renderAdminData);

  async function renderAdminData() {
    if (!adminDashboard) return;
    let bookings = [], treks = [], batches = [];
    const backendStatus = $("#backendStatus");
    try {
      const data = await apiFetch("/api/admin/dashboard");
      bookings = data.bookings || [];
      treks = data.treks || [];
      batches = data.batches || [];
      lastAdminBookings = bookings;
      if (backendStatus) backendStatus.textContent = "Backend: protected & connected";
    } catch (error) {
      if (backendStatus) backendStatus.textContent = "Backend: access denied";
      return;
    }

    const body = $("#adminBookingBody");
    if (body) {
      body.innerHTML = bookings.length ? "" : `<tr><td colspan="10">No bookings yet.</td></tr>`;
      bookings.forEach(booking => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${booking.bookingId}</strong></td><td>${booking.customerName || "-"}</td><td>${booking.trek || "-"}</td><td>${booking.date || "-"}</td><td>${booking.pickup || "-"}</td><td>${booking.dropPoint || "-"}</td><td>${rupee.format(Number(booking.total || 0))}</td><td>${booking.couponCode || "-"}</td><td><span class="payment-status-pill ${statusClass(booking.paymentStatus)}">${booking.paymentStatus || "Pending"}</span></td><td><select data-booking-status="${booking.bookingId}"><option>Payment Pending</option><option>Payment Under Review</option><option>Payment Confirmed</option><option>Payment Rejected</option><option>Coupon Free Booking</option></select><button class="secondary-btn" data-update-status="${booking.bookingId}">Update</button></td>`;
        body.appendChild(tr);
        const select = $(`[data-booking-status="${booking.bookingId}"]`, tr);
        if (select) select.value = booking.paymentStatus || "Payment Pending";
      });
      $$('[data-update-status]', body).forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.updateStatus;
        const select = $(`[data-booking-status="${id}"]`);
        const status = select.value;
        try {
          await apiFetch("/api/admin/bookings/" + encodeURIComponent(id) + "/status", { method: "PATCH", body: JSON.stringify({ paymentStatus: status }) });
          await renderAdminData();
        } catch (error) { alert(error.message || "Could not update status."); }
      }));
    }

    const trekList = $("#adminTreksList");
    if (trekList) trekList.innerHTML = treks.map(t => `<div class="admin-list-item"><strong>${t.name}</strong><span>${t.difficulty} • ${t.duration}</span><p>${t.description || ""}</p></div>`).join("");
    const batchList = $("#adminBatchesList");
    if (batchList) batchList.innerHTML = batches.map(b => `<div class="admin-list-item"><strong>${b.trek}</strong><span>${b.date} • ${rupee.format(Number(b.price))}</span></div>`).join("");
  }

  function statusClass(status) {
    status = String(status || '').toLowerCase();
    if (status.includes('confirmed')) return 'confirmed';
    if (status.includes('review')) return 'review';
    if (status.includes('rejected')) return 'rejected';
    if (status.includes('coupon') || status.includes('free')) return 'confirmed';
    return '';
  }

  const adminTrekForm = $("#adminTrekForm");
  if (adminTrekForm) adminTrekForm.addEventListener("submit", async e => {
    e.preventDefault();
    const trek = {
      id: "T-" + Date.now(),
      name: $("#adminTrekName").value.trim(),
      difficulty: $("#adminTrekDifficulty").value,
      duration: $("#adminTrekDuration").value.trim(),
      description: $("#adminTrekDesc").value.trim()
    };
    if (!trek.name || !trek.duration || !trek.description) return showMessage($("#adminTrekMessage"), "Please fill all trek details.", true);
    try {
      await apiFetch("/api/admin/treks", { method: "POST", body: JSON.stringify(trek) });
      adminTrekForm.reset();
      showMessage($("#adminTrekMessage"), "Trek saved securely.", false);
      await renderAdminData();
    } catch (error) { showMessage($("#adminTrekMessage"), error.message || "Could not save trek.", true); }
  });

  const adminBatchForm = $("#adminBatchForm");
  if (adminBatchForm) adminBatchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const batch = {
      id: "B-" + Date.now(),
      trek: $("#adminBatchTrek").value.trim(),
      note: "Admin added batch",
      date: $("#adminBatchDate").value.trim(),
      price: Number($("#adminBatchPrice").value)
    };
    if (!batch.trek || !batch.date || !batch.price) return showMessage($("#adminBatchMessage"), "Please fill all batch details.", true);
    try {
      await apiFetch("/api/admin/batches", { method: "POST", body: JSON.stringify(batch) });
      adminBatchForm.reset();
      showMessage($("#adminBatchMessage"), "Batch saved securely. It will appear on booking page.", false);
      await renderAdminData();
    } catch (error) { showMessage($("#adminBatchMessage"), error.message || "Could not save batch.", true); }
  });

  const exportBookingsBtn = $("#exportBookingsBtn");
  if (exportBookingsBtn) exportBookingsBtn.addEventListener("click", () => {
    const rows = lastAdminBookings;
    if (!rows.length) return alert("No bookings to export.");
    const header = ["Booking ID", "Name", "Phone", "Email", "Trek", "Date", "Members", "Pickup", "Drop Point", "Total", "Payment Status"];
    const csv = [header.join(",")].concat(rows.map(b => [b.bookingId, b.customerName, b.phone, b.email, b.trek, b.date, b.members, b.pickup, b.dropPoint, b.total, b.paymentStatus].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "green-trekkers-bookings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
})();

