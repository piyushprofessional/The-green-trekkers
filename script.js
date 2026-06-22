// The Green Trekkers - public booking + admin dashboard + coupons + gallery approvals
(function () {
  "use strict";
 const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);
  const rupee = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const whatsappNumber = "";
  const whatsappChannelLink = "https://whatsapp.com/channel/0029Vb8vXbYDjiOiMpjSqh1X";
  const instagramLink = "https://www.instagram.com/the_green_trekkers?igsh=MTM0dnI0cDhzcHhn";
  const businessEmail = "thegreentrekkers5@gmail.com";
  const feedbackLink = "mailto:thegreentrekkers5@gmail.com?subject=The%20Green%20Trekkers%20Feedback";
  const currentPage = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const API_BASE = (() => {
    const host = window.location.hostname;
    const port = window.location.port;
    const isFile = window.location.protocol === "file:";
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (isFile || (isLocalhost && port && port !== "5000")) return "http://localhost:5000";
    return "";
  })();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const defaultBatches = [
    { id: "B-RAJ-01", trek: "Rajmachi Fort Trek", note: "Night trail + fireflies", date: "Coming Soon", price: 1299, seatLimit: 0, available: false },
    { id: "B-KAL-01", trek: "Kalsubai Peak Trek", note: "Highest peak of Maharashtra", date: "Coming Soon", price: 1599, seatLimit: 0, available: false },
    { id: "B-DEV-01", trek: "Devkund Waterfall Trek", note: "Forest walk + waterfall", date: "Coming Soon", price: 1499, seatLimit: 0, available: false },
    { id: "B-HAR-01", trek: "Harishchandragad Trek", note: "Konkan Kada sunrise batch", date: "04 July 2026, 11:00 PM", price: 1199, seatLimit: 30, available: true },
    { id: "B-SAN-01", trek: "Sandhan Valley Trek", note: "Camping + adventure trail", date: "Coming Soon", price: 2999, seatLimit: 0, available: false },
    { id: "B-AND-01", trek: "Andharban Jungle Trek", note: "Mist, forest + waterfall trail", date: "Coming Soon", price: 1799, seatLimit: 0, available: false }
  ];

  const defaultTreks = [
    {
      id: "T-RAJ", name: "Rajmachi Fort Trek", difficulty: "Beginner", duration: "1 Day / 1 Night", available: false,
      description: "Night trail near Lonavala with fireflies and forest route.",
      inclusions: ["Basic trek leader guidance", "Route coordination", "Group support"],
      exclusions: ["Meals unless mentioned", "Personal expenses", "Insurance", "Anything not mentioned in inclusions"]
    },
    {
      id: "T-KAL", name: "Kalsubai Peak Trek", difficulty: "Moderate", duration: "1 Day", available: false,
      description: "Maharashtra's highest peak with sunrise views.",
      inclusions: ["Trek leader guidance", "Route coordination", "Basic first aid"],
      exclusions: ["Meals unless mentioned", "Personal expenses", "Insurance", "Transport unless mentioned"]
    },
    {
      id: "T-DEV", name: "Devkund Waterfall Trek", difficulty: "Beginner", duration: "1 Day", available: false,
      description: "Jungle trail ending at a waterfall.",
      inclusions: ["Guide support", "Route coordination", "Basic first aid"],
      exclusions: ["Meals unless mentioned", "Personal expenses", "Insurance", "Entry charges if any"]
    },
    {
      id: "T-HAR", name: "Harishchandragad Trek", difficulty: "Difficult", duration: "1 Day / 1 Night", available: true,
      description: "Konkan Kada, caves and sunrise route. Fixed batch starts on 04 July at 11:00 PM.",
      inclusions: ["Experienced trek leader", "Route guidance", "Basic first-aid support", "Pickup/drop coordination from Moshi or Chakan", "Booking confirmation ticket"],
      exclusions: ["Meals unless specifically announced", "Personal expenses", "Trekking shoes/rainwear/torch", "Travel insurance", "Anything not mentioned in inclusions"]
    },
    {
      id: "T-SAN", name: "Sandhan Valley Trek", difficulty: "Adventure", duration: "2 Days", available: false,
      description: "Camping, valley route and adventure patches.",
      inclusions: ["Guide support", "Route coordination", "Basic first aid"],
      exclusions: ["Meals unless mentioned", "Personal expenses", "Insurance", "Rental gear"]
    },
    {
      id: "T-AND", name: "Andharban Jungle Trek", difficulty: "Moderate", duration: "1 Day", available: false,
      description: "Descending forest trek with mist and waterfalls.",
      inclusions: ["Guide support", "Route coordination", "Basic first aid"],
      exclusions: ["Meals unless mentioned", "Personal expenses", "Insurance", "Transport unless mentioned"]
    }
  ];

  let cachedBatches = defaultBatches.slice();
  let cachedTreks = defaultTreks.slice();

  function showMessage(element, text, isError) {
    if (!element) return;
    element.textContent = text || "";
    element.classList.toggle("error", Boolean(isError));
    element.classList.toggle("success", Boolean(text && !isError));
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
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
      throw new Error("Backend is not connected. Run npm install and npm start, then open http://localhost:5000");
    }
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error((data && data.error) || "API error " + response.status);
    return data;
  }

  function parseAmount(priceText) { return Number(String(priceText || "").replace(/[^0-9]/g, "")) || 0; }
  function generateBookingId() { return "GT-" + new Date().toISOString().slice(2, 10).replace(/-/g, "") + "-" + Math.floor(1000 + Math.random() * 9000); }
  function normalizeCoupon(code) { return String(code || "").trim().toUpperCase().replace(/\s+/g, ""); }
  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  // Theme, nav and page basics
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

  $$(".site-nav a[data-page]").forEach(link => {
    const href = link.getAttribute("href") || "";
    if (href.toLowerCase() === currentPage) link.classList.add("active");
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

  const revealElements = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("visible"); }), { threshold: 0.12 });
    revealElements.forEach(el => observer.observe(el));
  } else revealElements.forEach(el => el.classList.add("visible"));

  function animateCounter(counter) {
    const target = Number(counter.dataset.target) || 0;
    const decimal = counter.dataset.decimal === "true";
    let start = null;
    function tick(now) {
      if (!start) start = now;
      const progress = Math.min((now - start) / 900, 1);
      const value = target * progress;
      counter.textContent = decimal ? (value / 10).toFixed(1) : Math.floor(value).toString();
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  const counters = $$(".counter");
  counters.forEach(animateCounter);

  // Data loading
  async function loadPublicData() {
    try {
      const [batches, treks] = await Promise.all([apiFetch("/api/batches"), apiFetch("/api/treks")]);
      if (Array.isArray(batches) && batches.length) cachedBatches = batches;
      if (Array.isArray(treks) && treks.length) cachedTreks = treks;
      writeJSON("greenTrekkersBatches", cachedBatches);
      writeJSON("greenTrekkersTreks", cachedTreks);
    } catch (_) {
      cachedBatches = readJSON("greenTrekkersBatches", defaultBatches);
      cachedTreks = readJSON("greenTrekkersTreks", defaultTreks);
    }
    return { batches: cachedBatches, treks: cachedTreks };
  }

  function getTrekInfo(trekName) {
    return cachedTreks.find(t => t.name === trekName) || defaultTreks.find(t => t.name === trekName) || defaultTreks[3];
  }

  // Booking page
  const bookingForm = $("#bookingForm");
  const selectedTrek = $("#selectedTrek"), selectedDate = $("#selectedDate"), selectedPrice = $("#selectedPrice"), selectedAmount = $("#selectedAmount"), membersInput = $("#members"), totalAmount = $("#totalAmount"), couponCodeInput = $("#couponCode"), applyCouponBtn = $("#applyCouponBtn"), couponMessage = $("#couponMessage"), bookingMessage = $("#bookingMessage"), confirmationBox = $("#confirmationBox"), confirmationText = $("#confirmationText"), newBookingBtn = $("#newBookingBtn"), paymentScreenshot = $("#paymentScreenshot"), screenshotName = $("#screenshotName"), bookingIdInput = $("#bookingId"), whatsappBtn = $("#whatsappBtn"), downloadTicketBtn = $("#downloadTicketBtn"), memberDetailsWrap = $("#memberDetails"), availableSeatsText = $("#availableSeatsText"), termsConsent = $("#termsConsent");
  let appliedCoupon = { code: "", percent: 0 };
  let lastConfirmedBooking = null;

  const summaryFields = {
    bookingId: $("#summaryBookingId"), name: $("#summaryName"), email: $("#summaryEmail"), trek: $("#summaryTrek"), date: $("#summaryDate"), members: $("#summaryMembers"), payment: $("#summaryPayment"), pickup: $("#summaryPickup"), dropPoint: $("#summaryDropPoint"), coupon: $("#summaryCoupon"), discount: $("#summaryDiscount"), total: $("#summaryTotal"), screenshot: $("#summaryScreenshot"), paymentStatus: $("#summaryPaymentStatus"), availableSeats: $("#summaryAvailableSeats")
  };

  function getCustomerName() { const input = $("#customerName"); return input ? input.value.trim() : ""; }
  function getEmail() { const input = $("#email"); return input ? input.value.trim() : ""; }
  function getPhone() { const input = $("#phone"); return input ? input.value.trim() : ""; }
  function getPickup() { const input = $("#pickup"); return input ? input.value : ""; }
  function getDropPoint() { const input = $("#dropPoint"); return input ? input.value : ""; }
  function getPaymentMode() { const input = $("#paymentMode"); return input ? input.value : ""; }
  function getScreenshotFileName() { return paymentScreenshot && paymentScreenshot.files && paymentScreenshot.files.length ? paymentScreenshot.files[0].name : ""; }

  function getCurrentBatch() {
    const trek = selectedTrek && selectedTrek.value;
    const date = selectedDate && selectedDate.value;
    return cachedBatches.find(b => b.trek === trek && b.date === date) || cachedBatches.find(b => b.trek === "Harishchandragad Trek") || defaultBatches[3];
  }
  function getAvailableSeats() {
    const batch = getCurrentBatch();
    if (!batch || batch.available === false) return 0;
    if (typeof batch.availableSeats === "number") return Math.max(0, batch.availableSeats);
    return Math.max(0, Number(batch.seatLimit || 30) - Number(batch.bookedMembers || 0));
  }

  function statusFromMode(mode, screenshot, finalTotal) {
    if (Number(finalTotal) === 0) return "Coupon Free Booking";
    if (mode === "UPI Payment Done" && screenshot) return "Payment Under Review";
    if (mode === "Will Pay Later") return "Payment Pending";
    return "Pending";
  }

  function getBookingTotals() {
    const baseAmount = Number(selectedAmount && selectedAmount.value) || parseAmount(selectedPrice && selectedPrice.value);
    const members = Number(membersInput && membersInput.value) || 1;
    const subtotal = baseAmount * members;
    const discount = Math.round(subtotal * (Number(appliedCoupon.percent) || 0) / 100);
    const finalTotal = Math.max(0, subtotal - discount);
    return { baseAmount, members, subtotal, discount, finalTotal };
  }

  function renderMemberDetails() {
    if (!memberDetailsWrap || !membersInput) return;
    const count = Math.max(1, Math.min(Number(membersInput.value) || 1, 10));
    const oldValues = {};
    $$("input", memberDetailsWrap).forEach(input => oldValues[input.id] = input.value);
    memberDetailsWrap.innerHTML = "";
    for (let i = 1; i <= count; i++) {
      const item = document.createElement("div");
      item.className = "member-detail-row";
      item.innerHTML = `
        <div>
          <label for="memberName${i}">Member ${i} Name</label>
          <input type="text" id="memberName${i}" data-member-name="${i}" placeholder="Full name" required />
        </div>
        <div>
          <label for="memberAge${i}">Member ${i} Age</label>
          <input type="number" id="memberAge${i}" data-member-age="${i}" min="5" max="75" placeholder="Age" required />
        </div>`;
      memberDetailsWrap.appendChild(item);
      const nameInput = $("#memberName" + i, memberDetailsWrap);
      const ageInput = $("#memberAge" + i, memberDetailsWrap);
      if (oldValues[nameInput.id]) nameInput.value = oldValues[nameInput.id];
      if (oldValues[ageInput.id]) ageInput.value = oldValues[ageInput.id];
      nameInput.addEventListener("input", updateSummary);
      ageInput.addEventListener("input", updateSummary);
    }
    const primaryName = $("#memberName1", memberDetailsWrap);
    if (primaryName && !primaryName.value && getCustomerName()) primaryName.value = getCustomerName();
    updateSummary();
  }

  function collectMemberDetails() {
    if (!membersInput) return [];
    const count = Math.max(1, Math.min(Number(membersInput.value) || 1, 10));
    const details = [];
    for (let i = 1; i <= count; i++) {
      const name = ($("#memberName" + i) || {}).value || "";
      const age = Number((($("#memberAge" + i) || {}).value || "").trim ? ($("#memberAge" + i).value || "") : ($("#memberAge" + i) || {}).value);
      details.push({ name: String(name).trim(), age });
    }
    return details;
  }

  async function applyCoupon(showStatus = true) {
    const code = normalizeCoupon(couponCodeInput && couponCodeInput.value);
    if (!couponCodeInput || !code) {
      appliedCoupon = { code: "", percent: 0 };
      if (showStatus) showMessage(couponMessage, "", false);
      updateTotal();
      return true;
    }
    const totals = getBookingTotals();
    try {
      const result = await apiFetch("/api/coupons/validate", { method: "POST", body: JSON.stringify({ couponCode: code, subtotal: totals.subtotal }) });
      appliedCoupon = { code: result.couponCode || code, percent: Number(result.couponPercent) || 0 };
      couponCodeInput.value = appliedCoupon.code;
      if (showStatus) showMessage(couponMessage, `Coupon applied: ${appliedCoupon.percent}% discount.`, false);
      updateTotal();
      return true;
    } catch (_) {
      appliedCoupon = { code: "", percent: 0 };
      if (showStatus) showMessage(couponMessage, "Invalid coupon code.", true);
      updateTotal();
      return false;
    }
  }

  function updateTrekDetails() {
    const container = $("#trekInclusionBox");
    if (!container || !selectedTrek) return;
    const info = getTrekInfo(selectedTrek.value || "Harishchandragad Trek");
    const incl = (info.inclusions || []).map(x => `<li>${x}</li>`).join("");
    const excl = (info.exclusions || []).map(x => `<li>${x}</li>`).join("");
    container.innerHTML = `
      <div><p class="eyebrow">Selected Trek Details</p><h3>${info.name}</h3><p>${info.description || ""}</p></div>
      <div class="inclusion-grid">
        <article><h4>✅ Inclusions</h4><ul>${incl}</ul></article>
        <article><h4>❌ Exclusions</h4><ul>${excl}</ul></article>
      </div>`;
  }

  function updateSummary() {
    if (!bookingForm) return;
    const totals = getBookingTotals();
    const members = totals.members;
    const screenshot = getScreenshotFileName();
    if (summaryFields.bookingId) summaryFields.bookingId.textContent = bookingIdInput.value || "GT-0000";
    if (summaryFields.name) summaryFields.name.textContent = getCustomerName() || "Not entered";
    if (summaryFields.email) summaryFields.email.textContent = getEmail() || "Not entered";
    if (summaryFields.trek) summaryFields.trek.textContent = selectedTrek.value.trim() || "Not selected";
    if (summaryFields.date) summaryFields.date.textContent = selectedDate.value.trim() || "Not selected";
    if (summaryFields.members) summaryFields.members.textContent = String(members);
    if (summaryFields.payment) summaryFields.payment.textContent = getPaymentMode() || "Not selected";
    if (summaryFields.pickup) summaryFields.pickup.textContent = getPickup() || "Not selected";
    if (summaryFields.dropPoint) summaryFields.dropPoint.textContent = getDropPoint() || "Not selected";
    if (summaryFields.coupon) summaryFields.coupon.textContent = appliedCoupon.code ? appliedCoupon.code + " (" + appliedCoupon.percent + "%)" : "Not applied";
    if (summaryFields.discount) summaryFields.discount.textContent = rupee.format(totals.discount);
    if (summaryFields.total) summaryFields.total.textContent = rupee.format(totals.finalTotal);
    if (summaryFields.screenshot) summaryFields.screenshot.textContent = screenshot || "Not uploaded";
    if (summaryFields.paymentStatus) summaryFields.paymentStatus.textContent = statusFromMode(getPaymentMode(), screenshot, totals.finalTotal);
    if (summaryFields.availableSeats) summaryFields.availableSeats.textContent = String(getAvailableSeats());
    if (availableSeatsText) availableSeatsText.textContent = getAvailableSeats() + " seats available";
  }

  function updateTotal() {
    if (!membersInput || !totalAmount) return;
    const totals = getBookingTotals();
    totalAmount.textContent = appliedCoupon.percent ? rupee.format(totals.finalTotal) + " after coupon" : rupee.format(totals.finalTotal);
    updateSummary();
  }

  function fillBooking(trek, date, price, amount, batch) {
    if (!selectedTrek || !selectedDate || !selectedPrice || !selectedAmount) return;
    selectedTrek.value = trek || "";
    selectedDate.value = date || "";
    selectedPrice.value = price || "";
    selectedAmount.value = amount || parseAmount(price);
    if (batch && availableSeatsText) availableSeatsText.textContent = `${batch.availableSeats ?? batch.seatLimit ?? 0} seats available`;
    updateTrekDetails(); updateTotal(); renderMemberDetails();
    if (couponCodeInput && couponCodeInput.value.trim()) applyCoupon(false);
    if (bookingForm) bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
        const batch = cachedBatches.find(b => b.trek === button.dataset.trek && b.date === button.dataset.date);
        fillBooking(button.dataset.trek, button.dataset.date, button.dataset.price, button.dataset.amount, batch);
      });
    });
  }

  async function renderDynamicBatches() {
    const tableBody = $("#batchTableBody");
    if (!tableBody) return;
    const { batches } = await loadPublicData();
    tableBody.innerHTML = "";
    batches.forEach(batch => {
      const isAvailable = batch.available !== false && batch.trek === "Harishchandragad Trek" && batch.date === "04 July 2026, 11:00 PM" && Number(batch.availableSeats ?? batch.seatLimit ?? 0) > 0;
      const dateText = isAvailable ? batch.date : "Coming Soon";
      const seatsText = isAvailable ? `${Number(batch.availableSeats ?? batch.seatLimit ?? 0)} available` : "Unavailable";
      const tr = document.createElement("tr");
      tr.className = isAvailable ? "" : "unavailable-row";
      const actionHtml = isAvailable
        ? `<button class="book-btn" data-available="true" data-trek="${batch.trek}" data-date="${dateText}" data-price="${rupee.format(Number(batch.price))}" data-amount="${Number(batch.price)}">Book Now</button>`
        : `<button class="book-btn unavailable-btn" type="button" data-available="false" disabled>${Number(batch.availableSeats || 0) <= 0 && batch.available ? "Sold Out" : "Unavailable"}</button>`;
      tr.innerHTML = `<td><strong>${batch.trek}</strong><span>${batch.note || "Trek option"}</span></td><td>${dateText}</td><td>${isAvailable ? rupee.format(Number(batch.price)) : "—"}</td><td>${seatsText}</td><td>${actionHtml}</td>`;
      tableBody.appendChild(tr);
    });
    bindBookButtons();
  }

  function buildWhatsappMessage(booking) {
    const membersText = (booking.memberDetails || []).map((m, i) => `${i + 1}. ${m.name} (${m.age})`).join("; ");
    return ["Hello The Green Trekkers, I want to confirm my trek booking.", "", "Booking ID: " + booking.bookingId, "Name: " + booking.customerName, "Email: " + booking.email, "Phone: " + booking.phone, "Trek: " + booking.trek, "Batch Date: " + booking.date, "Members: " + booking.members, "Member Details: " + membersText, "Price Per Person: " + booking.price, "Total Amount: " + rupee.format(booking.total), "Pickup Point: " + booking.pickup, "Drop Point: " + (booking.dropPoint || "Not selected"), "Payment Mode: " + booking.paymentMode, "Payment Status: " + booking.paymentStatus, "Payment Screenshot: " + (booking.paymentScreenshot || "Not uploaded")].join("\n");
  }

  if (bookingIdInput && !bookingIdInput.value) bookingIdInput.value = generateBookingId();
  if (couponCodeInput) {
    const privateCouponFromUrl = normalizeCoupon(new URLSearchParams(window.location.search).get("coupon"));
    if (privateCouponFromUrl) couponCodeInput.value = privateCouponFromUrl;
  }

  if (bookingForm) {
    renderDynamicBatches().then(() => {
      const batch = cachedBatches.find(b => b.trek === "Harishchandragad Trek") || defaultBatches[3];
      fillBooking(batch.trek, batch.date, rupee.format(Number(batch.price)), batch.price, batch);
      if (couponCodeInput && couponCodeInput.value.trim()) setTimeout(() => applyCoupon(false), 250);
    });
    bindBookButtons();
    renderMemberDetails(); updateTrekDetails(); updateTotal();
    if (membersInput) {
      membersInput.addEventListener("input", () => { renderMemberDetails(); updateTotal(); });
      membersInput.addEventListener("change", () => { renderMemberDetails(); updateTotal(); });
    }
    [selectedTrek, selectedDate, $("#customerName"), $("#email"), $("#phone"), $("#pickup"), $("#dropPoint"), $("#paymentMode")].filter(Boolean).forEach(field => {
      field.addEventListener("input", () => { if (field.id === "customerName") { const primary = $("#memberName1"); if (primary && !primary.value) primary.value = getCustomerName(); } updateSummary(); });
      field.addEventListener("change", () => { updateTrekDetails(); updateSummary(); });
    });
    if (applyCouponBtn) applyCouponBtn.addEventListener("click", () => applyCoupon(true));
    if (couponCodeInput) {
      couponCodeInput.addEventListener("input", () => { if (!couponCodeInput.value.trim()) { appliedCoupon = { code: "", percent: 0 }; showMessage(couponMessage, "", false); updateTotal(); } });
      couponCodeInput.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); applyCoupon(true); } });
    }
    if (paymentScreenshot) paymentScreenshot.addEventListener("change", () => { const fileName = getScreenshotFileName(); if (screenshotName) screenshotName.textContent = fileName ? "Uploaded: " + fileName : "Optional for 'Will Pay Later'. Required after UPI payment."; updateSummary(); });

    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (couponCodeInput && couponCodeInput.value.trim()) {
        const couponOk = await applyCoupon(false);
        if (!couponOk) return showMessage(bookingMessage, "Coupon code is invalid.", true);
      }
      const trek = selectedTrek.value.trim(), date = selectedDate.value.trim(), price = selectedPrice.value.trim(), customerName = getCustomerName(), email = getEmail(), phone = getPhone(), pickup = getPickup(), dropPoint = getDropPoint(), paymentMode = getPaymentMode(), paymentScreenshotName = getScreenshotFileName(), bookingId = bookingIdInput.value || generateBookingId();
      const totals = getBookingTotals();
      const members = totals.members, amount = totals.baseAmount, total = totals.finalTotal;
      const memberDetails = collectMemberDetails();
      if (!trek || !date || !price) return showMessage(bookingMessage, "Please select a trek batch first.", true);
      if (customerName.length < 3) return showMessage(bookingMessage, "Please enter your full name.", true);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showMessage(bookingMessage, "Please enter a valid email for booking confirmation.", true);
      if (!/^[0-9]{10}$/.test(phone)) return showMessage(bookingMessage, "Please enter a valid 10 digit phone number.", true);
      if (!pickup || !["Moshi", "Chakan"].includes(pickup)) return showMessage(bookingMessage, "Please select Moshi or Chakan pickup point.", true);
      if (!dropPoint || !["Moshi", "Chakan"].includes(dropPoint)) return showMessage(bookingMessage, "Please select Moshi or Chakan drop point.", true);
      if (memberDetails.length !== members || memberDetails.some(m => m.name.length < 2 || !m.age || m.age < 5 || m.age > 75)) return showMessage(bookingMessage, "Please enter valid name and age for every member.", true);
      if (getAvailableSeats() < members) return showMessage(bookingMessage, `Only ${getAvailableSeats()} seats are available. Please reduce members.`, true);
      if (total > 0 && !paymentMode) return showMessage(bookingMessage, "Please select payment status.", true);
      if (total > 0 && paymentMode === "UPI Payment Done" && !paymentScreenshotName) return showMessage(bookingMessage, "Please upload your payment screenshot after UPI payment.", true);
      if (!termsConsent || !termsConsent.checked) return showMessage(bookingMessage, "Please accept the terms, conditions and trek consent before confirming.", true);
      const booking = { bookingId, trek, date, price, members, memberDetails, amount, subtotal: totals.subtotal, couponCode: appliedCoupon.code || "", couponPercent: appliedCoupon.percent || 0, discountAmount: totals.discount, total, customerName, email, phone, pickup, dropPoint, paymentMode: total === 0 ? "Coupon / Free Booking" : paymentMode, paymentStatus: statusFromMode(paymentMode, paymentScreenshotName, total), paymentScreenshot: paymentScreenshotName, consentAccepted: true, termsAcceptedAt: new Date().toISOString(), bookedAt: new Date().toISOString() };
      try {
        const savedBooking = await apiFetch("/api/bookings", { method: "POST", body: JSON.stringify(booking) });
        Object.assign(booking, savedBooking);
        try {
          await apiFetch("/api/send-confirmation", { method: "POST", body: JSON.stringify({ booking }) });
        } catch (emailError) {
          console.warn("Booking saved, but confirmation email failed:", emailError);
        }
        await loadPublicData();
      } catch (error) {
        return showMessage(bookingMessage, error.message || "Booking could not be saved. Please try again.", true);
      }
      writeJSON("greenTrekkersLastBooking", booking); lastConfirmedBooking = booking;
      const memberLines = (booking.memberDetails || []).map((m, i) => `${i + 1}. ${m.name} - ${m.age} yrs`).join("<br>");
      if (confirmationText) confirmationText.innerHTML = `
        <div class="ticket-preview"><h3>The Green Trekkers Booking Ticket</h3>
        <p><strong>Booking ID:</strong> ${booking.bookingId}</p><p><strong>Name:</strong> ${booking.customerName}</p><p><strong>Email:</strong> ${booking.email}</p><p><strong>Phone:</strong> ${booking.phone}</p>
        <p><strong>Trek:</strong> ${booking.trek}</p><p><strong>Date:</strong> ${booking.date}</p><p><strong>Members:</strong><br>${memberLines}</p>
        <p><strong>Pickup:</strong> ${booking.pickup} &nbsp; <strong>Drop:</strong> ${booking.dropPoint}</p>
        <p><strong>Subtotal:</strong> ${rupee.format(booking.subtotal)} | <strong>Discount:</strong> ${rupee.format(booking.discountAmount || 0)} | <strong>Total:</strong> ${rupee.format(booking.total)}</p>
        <p><strong>Payment:</strong> ${booking.paymentStatus}</p><p class="small-note">Confirmation email has been sent if SMTP is configured on hosting.</p>
        <a href="${feedbackLink}" class="secondary-btn full-btn">Share Review / Feedback</a></div>`;
      if (whatsappBtn) {
        whatsappBtn.href = whatsappNumber ? "https://wa.me/" + whatsappNumber + "?text=" + encodeURIComponent(buildWhatsappMessage(booking)) : whatsappChannelLink;
        whatsappBtn.textContent = whatsappNumber ? "Confirm Booking on WhatsApp" : "Open WhatsApp Channel";
        whatsappBtn.classList.remove("hidden");
      }
      if (downloadTicketBtn) downloadTicketBtn.classList.remove("hidden");
      if (confirmationBox) confirmationBox.classList.remove("hidden");
      showMessage(bookingMessage, "Booking saved successfully. Ticket is ready and confirmation email will be sent when SMTP is configured.", false);
      updateSummary(); renderDynamicBatches(); if (confirmationBox) confirmationBox.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  if (newBookingBtn && bookingForm) newBookingBtn.addEventListener("click", () => {
    bookingForm.reset(); appliedCoupon = { code: "", percent: 0 }; if (couponMessage) showMessage(couponMessage, "", false); if (selectedAmount) selectedAmount.value = "1199"; if (membersInput) membersInput.value = "1"; if (bookingIdInput) bookingIdInput.value = generateBookingId(); if (whatsappBtn) whatsappBtn.classList.add("hidden"); if (downloadTicketBtn) downloadTicketBtn.classList.add("hidden"); if (screenshotName) screenshotName.textContent = "Optional for 'Will Pay Later'. Required after UPI payment."; renderMemberDetails(); updateTotal(); updateTrekDetails(); if (confirmationBox) confirmationBox.classList.add("hidden"); showMessage(bookingMessage, "", false); bookingForm.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  if (downloadTicketBtn) downloadTicketBtn.addEventListener("click", () => downloadReceiptPdf(lastConfirmedBooking || readJSON("greenTrekkersLastBooking", null)));

  function pdfEscape(text) { return String(text ?? "").replace(/[\\()]/g, "\\$&").replace(/₹/g, "Rs."); }
  function downloadReceiptPdf(booking) {
    if (!booking) return alert("Please confirm a booking first.");
    const members = (booking.memberDetails || []).map((m, i) => `${i + 1}. ${m.name} - ${m.age} yrs`).join(" | ");
    const lines = [
      "THE GREEN TREKKERS", "Official Trek Booking Ticket", "", "Booking ID: " + booking.bookingId, "Customer: " + booking.customerName, "Email: " + booking.email, "Phone: " + booking.phone, "", "Trek: " + booking.trek, "Batch: " + booking.date, "Members: " + booking.members, "Member Details: " + members, "Pickup: " + booking.pickup, "Drop: " + booking.dropPoint, "", "Subtotal: Rs. " + (booking.subtotal || 0), "Coupon: " + (booking.couponCode || "Not applied"), "Discount: Rs. " + (booking.discountAmount || 0), "Total Amount: Rs. " + booking.total, "Payment Status: " + booking.paymentStatus, "", "Terms accepted: Yes", "Consent accepted: Yes", "", "Support: 9535917287 / 8668971953", "Email: " + businessEmail, "Feedback: " + feedbackLink, "", "Carry trekking shoes, water bottle, torch, rainwear and personal medicines."
    ];
    let textOps = "q 0.95 0.95 0.95 rg 36 36 523 770 re f Q\n";
    textOps += "q 0.05 0.22 0.12 rg 36 756 523 50 re f Q\n";
    textOps += "BT /F1 22 Tf 56 775 Td 1 1 1 rg (" + pdfEscape(lines[0]) + ") Tj ET\n";
    textOps += "BT /F1 12 Tf 56 735 Td 18 TL 0 0 0 rg";
    lines.slice(1).forEach(line => { textOps += " T* (" + pdfEscape(line).slice(0, 110) + ") Tj"; });
    textOps += " ET";
    const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "<< /Length " + textOps.length + " >>\nstream\n" + textOps + "\nendstream"];
    let pdf = "%PDF-1.4\n"; const offsets = [0];
    objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += (i+1) + " 0 obj\n" + obj + "\nendobj\n"; });
    const xref = pdf.length; pdf += "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    const blob = new Blob([pdf], { type: "application/pdf" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = (booking.bookingId || "trek-ticket") + ".pdf"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }

  // Gallery page with admin approval flow
  const galleryModal = $("#galleryModal"), galleryModalContent = $("#galleryModalContent"), galleryCaption = $("#galleryCaption");
  function openGallery(card) {
    if (!galleryModal || !galleryModalContent) return;
    const img = $("img", card); const emoji = $("div", card);
    galleryModalContent.innerHTML = img ? `<img src="${img.src}" alt="${img.alt || "Gallery preview"}">` : `<div class="emoji-preview">${emoji ? emoji.textContent : "⛰️"}</div>`;
    if (galleryCaption) galleryCaption.textContent = card.dataset.caption || $("span", card)?.textContent || "The Green Trekkers";
    galleryModal.classList.remove("hidden");
  }
  function bindGalleryCards() { $$(".gallery-card").forEach(card => { if (card.dataset.bound === "true") return; card.dataset.bound = "true"; card.addEventListener("click", () => openGallery(card)); }); }
  $$(".filter-btn").forEach(btn => btn.addEventListener("click", () => { $$(".filter-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); const filter = btn.dataset.filter; $$(".gallery-card").forEach(card => card.classList.toggle("hidden-card", filter !== "all" && card.dataset.category !== filter)); }));
  bindGalleryCards();
  const closeGalleryModal = $("#closeGalleryModal");
  if (closeGalleryModal) closeGalleryModal.addEventListener("click", () => galleryModal.classList.add("hidden"));
  if (galleryModal) galleryModal.addEventListener("click", e => { if (e.target === galleryModal) galleryModal.classList.add("hidden"); });

  async function renderApprovedGallery() {
    const approvedGallery = $("#approvedGallery");
    if (!approvedGallery) return;
    try {
      const items = await apiFetch("/api/gallery/approved");
      approvedGallery.innerHTML = items.length ? "" : `<p class="hint">No community photos approved yet.</p>`;
      items.forEach(item => {
        const card = document.createElement("article");
        card.className = "gallery-card user-photo-card";
        card.dataset.category = "group";
        card.dataset.caption = item.caption || "Approved community photo";
        card.innerHTML = `<img src="${item.imageData}" alt="${item.caption || "Approved trek photo"}"><span>${item.caption || "Community Photo"}</span>`;
        approvedGallery.appendChild(card);
      });
      bindGalleryCards();
    } catch (_) {}
  }
  renderApprovedGallery();

  const galleryUploadForm = $("#galleryUploadForm");
  if (galleryUploadForm) galleryUploadForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fileInput = $("#galleryUpload");
    const msg = $("#galleryUploadMessage");
    const file = fileInput && fileInput.files && fileInput.files[0];
    if (!file) return showMessage(msg, "Please choose one photo.", true);
    if (file.size > 2 * 1024 * 1024) return showMessage(msg, "Photo must be below 2 MB for this demo hosting.", true);
    try {
      const imageData = await fileToDataUrl(file);
      await apiFetch("/api/gallery/submit", { method: "POST", body: JSON.stringify({ uploaderName: $("#galleryUploaderName").value, uploaderEmail: $("#galleryUploaderEmail").value, caption: $("#galleryCaptionInput").value, fileName: file.name, imageData }) });
      galleryUploadForm.reset();
      showMessage(msg, "Photo submitted. It will show in gallery after admin approval.", false);
    } catch (error) { showMessage(msg, error.message || "Upload failed.", true); }
  });

  // Admin dashboard
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
  if (adminLogoutBtn) adminLogoutBtn.addEventListener("click", async () => { try { await apiFetch("/api/admin/logout", { method: "POST" }); } catch (_) {} window.location.href = "admin-login.html"; });
  const refreshAdminBtn = $("#refreshAdminBtn");
  if (refreshAdminBtn) refreshAdminBtn.addEventListener("click", renderAdminData);

  function statusClass(status) {
    status = String(status || '').toLowerCase();
    if (status.includes('confirmed') || status.includes('coupon') || status.includes('free')) return 'confirmed';
    if (status.includes('review')) return 'review';
    if (status.includes('rejected')) return 'rejected';
    return '';
  }

  async function renderAdminData() {
    if (!adminDashboard) return;
    const backendStatus = $("#backendStatus");
    let bookings = [], treks = [], batches = [], gallerySubmissions = [];
    try {
      const data = await apiFetch("/api/admin/dashboard");
      bookings = data.bookings || []; treks = data.treks || []; batches = data.batches || []; gallerySubmissions = data.gallerySubmissions || [];
      lastAdminBookings = bookings;
      if (backendStatus) backendStatus.textContent = "Backend: protected & connected";
    } catch (_) { if (backendStatus) backendStatus.textContent = "Backend: access denied"; return; }

    const body = $("#adminBookingBody");
    if (body) {
      body.innerHTML = bookings.length ? "" : `<tr><td colspan="12">No bookings yet.</td></tr>`;
      bookings.forEach(booking => {
        const details = (booking.memberDetails || []).map(m => `${m.name} (${m.age})`).join(", ");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><strong>${booking.bookingId}</strong></td><td>${booking.customerName || "-"}<br><small>${booking.email || ""}</small><br><small>${booking.phone || ""}</small></td><td>${booking.trek || "-"}</td><td>${booking.date || "-"}</td><td>${booking.members || 1}<br><small>${details}</small></td><td>${booking.pickup || "-"}</td><td>${booking.dropPoint || "-"}</td><td>${rupee.format(Number(booking.total || 0))}</td><td>${booking.couponCode || "-"}</td><td>${booking.consentAccepted ? "Yes" : "No"}</td><td><span class="payment-status-pill ${statusClass(booking.paymentStatus)}">${booking.paymentStatus || "Pending"}</span></td><td><select data-booking-status="${booking.bookingId}"><option>Payment Pending</option><option>Payment Under Review</option><option>Payment Confirmed</option><option>Payment Rejected</option><option>Coupon Free Booking</option></select><button class="secondary-btn" data-update-status="${booking.bookingId}">Update</button></td>`;
        body.appendChild(tr);
        const select = $(`[data-booking-status="${booking.bookingId}"]`, tr);
        if (select) select.value = booking.paymentStatus || "Payment Pending";
      });
      $$('[data-update-status]', body).forEach(btn => btn.addEventListener('click', async () => {
        const id = btn.dataset.updateStatus; const select = $(`[data-booking-status="${id}"]`); const status = select.value;
        try { await apiFetch("/api/admin/bookings/" + encodeURIComponent(id) + "/status", { method: "PATCH", body: JSON.stringify({ paymentStatus: status }) }); await renderAdminData(); } catch (error) { alert(error.message || "Could not update status."); }
      }));
    }

    const trekList = $("#adminTreksList");
    if (trekList) trekList.innerHTML = treks.map(t => `<div class="admin-list-item"><strong>${t.name}</strong><span>${t.difficulty} • ${t.duration} • ${t.available ? "Available" : "Unavailable"}</span><p>${t.description || ""}</p></div>`).join("");
    const batchList = $("#adminBatchesList");
    if (batchList) batchList.innerHTML = batches.map(b => `<div class="admin-list-item"><strong>${b.trek}</strong><span>${b.date} • ${rupee.format(Number(b.price))} • ${b.availableSeats ?? 0}/${b.seatLimit ?? 0} seats left</span></div>`).join("");

    const galleryList = $("#adminGalleryList");
    if (galleryList) {
      const pending = gallerySubmissions.filter(item => item.status === "pending");
      galleryList.innerHTML = pending.length ? "" : `<p class="hint">No pending gallery approvals.</p>`;
      pending.forEach(item => {
        const card = document.createElement("article");
        card.className = "gallery-approval-card";
        card.innerHTML = `<img src="${item.imageData}" alt="${item.caption || "Pending photo"}"><div><strong>${item.caption || "Untitled"}</strong><p>${item.uploaderName || "Guest"} • ${item.uploaderEmail || "No email"}</p><button class="primary-btn" data-gallery-action="approve" data-gallery-id="${item.id}">Approve</button><button class="secondary-btn" data-gallery-action="reject" data-gallery-id="${item.id}">Reject</button></div>`;
        galleryList.appendChild(card);
      });
      $$('[data-gallery-action]', galleryList).forEach(btn => btn.addEventListener('click', async () => {
        const status = btn.dataset.galleryAction === 'approve' ? 'approved' : 'rejected';
        try { await apiFetch('/api/admin/gallery/' + encodeURIComponent(btn.dataset.galleryId) + '/status', { method: 'PATCH', body: JSON.stringify({ status }) }); await renderAdminData(); } catch (error) { alert(error.message || 'Could not update gallery photo.'); }
      }));
    }
  }

  const adminTrekForm = $("#adminTrekForm");
  if (adminTrekForm) adminTrekForm.addEventListener("submit", async e => {
    e.preventDefault();
    const trek = { id: "T-" + Date.now(), name: $("#adminTrekName").value.trim(), difficulty: $("#adminTrekDifficulty").value, duration: $("#adminTrekDuration").value.trim(), description: $("#adminTrekDesc").value.trim(), available: false, inclusions: ["Guide support", "Route coordination"], exclusions: ["Meals unless mentioned", "Personal expenses"] };
    if (!trek.name || !trek.duration || !trek.description) return showMessage($("#adminTrekMessage"), "Please fill all trek details.", true);
    try { await apiFetch("/api/admin/treks", { method: "POST", body: JSON.stringify(trek) }); adminTrekForm.reset(); showMessage($("#adminTrekMessage"), "Trek saved securely.", false); await renderAdminData(); } catch (error) { showMessage($("#adminTrekMessage"), error.message || "Could not save trek.", true); }
  });

  const adminBatchForm = $("#adminBatchForm");
  if (adminBatchForm) adminBatchForm.addEventListener("submit", async e => {
    e.preventDefault();
    const batch = { id: "B-" + Date.now(), trek: $("#adminBatchTrek").value.trim(), note: "Admin added batch", date: $("#adminBatchDate").value.trim(), price: Number($("#adminBatchPrice").value), seatLimit: Number($("#adminBatchSeats") ? $("#adminBatchSeats").value : 30), available: false };
    if (!batch.trek || !batch.date || !batch.price) return showMessage($("#adminBatchMessage"), "Please fill all batch details.", true);
    try { await apiFetch("/api/admin/batches", { method: "POST", body: JSON.stringify(batch) }); adminBatchForm.reset(); showMessage($("#adminBatchMessage"), "Batch saved securely. Mark available in backend/admin as needed.", false); await renderAdminData(); } catch (error) { showMessage($("#adminBatchMessage"), error.message || "Could not save batch.", true); }
  });

  const exportBookingsBtn = $("#exportBookingsBtn");
  if (exportBookingsBtn) exportBookingsBtn.addEventListener("click", () => {
    const rows = lastAdminBookings;
    if (!rows.length) return alert("No bookings to export.");
    const header = ["Booking ID", "Name", "Email", "Phone", "Trek", "Date", "Members", "Member Details", "Pickup", "Drop Point", "Total", "Coupon", "Consent", "Payment Status"];
    const csv = [header.join(",")].concat(rows.map(b => [b.bookingId, b.customerName, b.email, b.phone, b.trek, b.date, b.members, (b.memberDetails || []).map(m => `${m.name} (${m.age})`).join("; "), b.pickup, b.dropPoint, b.total, b.couponCode, b.consentAccepted ? "Yes" : "No", b.paymentStatus].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "green-trekkers-bookings.csv"; document.body.appendChild(a); a.click(); a.remove();
  });
})();



