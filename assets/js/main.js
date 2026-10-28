/* Homeo Heal — shared behaviour */

/* ---------- Edit these for your clinic ---------- */
const CLINIC = {
  name: "Homeo Heal",
  // Preferred: the Google Apps Script web app URL (see apps-script/Code.gs). It saves each request to the
  // Google Sheet (tabs "Appointments" and "Call Backs") and sends the branded email alert.
  sheetEndpoint: "https://script.google.com/macros/s/AKfycbwxfTLKupC4rNfu2QxrVsYiu1jcIu_S_ijpqTjhLltEIgizHhY_lv4OHsokBmkPPEvA7Q/exec",
  // Fallback used only while sheetEndpoint is empty: plain email alerts through FormSubmit's private alias.
  notifyEndpoint: "https://formsubmit.co/ajax/92d1ecd063deda6ce57d0b83a5acca9d",
  resetAfterSeconds: 6,
  // 0 = Sunday. Each entry is [start, end) in 24h time, booked in 30-minute slots.
  hours: {
    0: [],
    1: [[10, 13], [17, 20]],
    2: [[10, 13], [17, 20]],
    3: [[10, 13], [17, 20]],
    4: [[10, 13], [17, 20]],
    5: [[10, 13], [17, 20]],
    6: [[10, 14]]
  },
  bookAheadDays: 60
};

/* ---------- Mobile menu ---------- */
(function () {
  const toggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("nav");
  if (!toggle || !nav) return;
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (e) => {
    if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
  });
})();

/* ---------- Count-up numbers ---------- */
(function () {
  const counters = document.querySelectorAll(".count");
  if (!counters.length) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function runCount(el) {
    const target = Number(el.dataset.target);
    if (reduceMotion) { el.textContent = target.toLocaleString("en-US"); return; }
    const start = performance.now(), dur = 1600;
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("en-US");
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { runCount(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    counters.forEach((c) => { c.textContent = "0"; io.observe(c); });
  } else {
    counters.forEach((c) => { c.textContent = Number(c.dataset.target).toLocaleString("en-US"); });
  }
})();

/* While a popup is open, lift its whole row above the rows below it so it is never covered. */
function raiseChain(el, on) {
  for (let n = el; n && n.tagName !== "FORM" && n !== document.body; n = n.parentElement) n.classList.toggle("raise", on);
}

function svgIcon(cls, d) {
  const NS = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none");
  s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
  s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true"); s.setAttribute("class", cls);
  const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.appendChild(p);
  return s;
}

/* ---------- Custom calendar: past dates, past years and closed days cannot be chosen ---------- */
function enhanceDate(input, isClosed) {
  const parseISO = (v) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const monthIndex = (d) => d.getFullYear() * 12 + d.getMonth();
  const getMin = () => (input.min ? parseISO(input.min) : new Date(new Date().setHours(0, 0, 0, 0)));
  const getMax = () => (input.max ? parseISO(input.max) : null);

  const wrap = document.createElement("div");
  wrap.className = "select datepicker";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "select-btn";
  btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  label.className = "select-label";
  btn.append(label, svgIcon("chev", "M6 9l6 6 6-6"));
  const pop = document.createElement("div");
  pop.className = "cal"; pop.id = input.id + "-cal"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Choose a date");
  btn.setAttribute("aria-controls", pop.id);
  const lab = document.querySelector(`label[for="${input.id}"]`);
  if (lab) { lab.id = lab.id || input.id + "-label"; btn.setAttribute("aria-labelledby", lab.id); }
  wrap.append(btn, pop);
  input.insertAdjacentElement("afterend", wrap);
  input.classList.add("sr-only");
  input.tabIndex = -1;
  input.setAttribute("aria-hidden", "true");
  input.addEventListener("focus", () => btn.focus());

  let view = new Date(getMin().getFullYear(), getMin().getMonth(), 1);

  function sync() {
    label.textContent = input.value
      ? parseISO(input.value).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "Select a date";
    label.classList.toggle("placeholder", !input.value);
    wrap.classList.toggle("invalid", input.getAttribute("aria-invalid") === "true");
  }

  function render() {
    const min = getMin(), max = getMax();
    pop.innerHTML = "";

    const head = document.createElement("div"); head.className = "cal-head";
    const prev = document.createElement("button"); prev.type = "button"; prev.className = "cal-nav"; prev.setAttribute("aria-label", "Previous month");
    prev.appendChild(svgIcon("", "M15 6l-6 6 6 6"));
    prev.disabled = monthIndex(view) <= monthIndex(min);
    prev.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
    const next = document.createElement("button"); next.type = "button"; next.className = "cal-nav"; next.setAttribute("aria-label", "Next month");
    next.appendChild(svgIcon("", "M9 6l6 6-6 6"));
    next.disabled = !!max && monthIndex(view) >= monthIndex(max);
    next.addEventListener("click", () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });
    const title = document.createElement("div"); title.className = "cal-title"; title.setAttribute("aria-live", "polite");
    title.textContent = view.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    head.append(prev, title, next);

    const grid = document.createElement("div"); grid.className = "cal-grid";
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach((n) => {
      const d = document.createElement("div"); d.className = "cal-dow"; d.textContent = n; grid.appendChild(d);
    });
    const lead = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) grid.appendChild(document.createElement("span"));
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const todayIso = isoOf(new Date());
    for (let n = 1; n <= days; n++) {
      const date = new Date(view.getFullYear(), view.getMonth(), n);
      const b = document.createElement("button"); b.type = "button"; b.className = "cal-day";
      b.textContent = String(n);
      b.dataset.iso = isoOf(date);
      const closed = isClosed(date);
      b.disabled = date < min || (!!max && date > max) || closed;
      if (closed && date >= min) b.title = "Clinic closed";
      if (b.dataset.iso === todayIso) b.classList.add("today");
      const selected = input.value === b.dataset.iso;
      if (selected) { b.classList.add("sel"); b.setAttribute("aria-pressed", "true"); }
      b.setAttribute("aria-label", date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      b.tabIndex = -1;
      b.addEventListener("click", () => pick(date));
      grid.appendChild(b);
    }
    const foot = document.createElement("p"); foot.className = "cal-foot";
    foot.textContent = "Past dates and clinic closed days can’t be selected.";
    pop.append(head, grid, foot);

    const enabled = [...pop.querySelectorAll(".cal-day:not(:disabled)")];
    const rove = pop.querySelector(".cal-day.sel:not(:disabled)") || enabled[0];
    if (rove) rove.tabIndex = 0;
  }

  function open(focusDay) {
    document.dispatchEvent(new CustomEvent("select-open", { detail: wrap }));
    if (input.value) { const v = parseISO(input.value); view = new Date(v.getFullYear(), v.getMonth(), 1); }
    else { const m = getMin(); view = new Date(m.getFullYear(), m.getMonth(), 1); }
    render();
    wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true");
    raiseChain(wrap, true);
    if (focusDay) { const t = pop.querySelector('.cal-day[tabindex="0"]'); if (t) t.focus(); }
  }
  function close() {
    if (!wrap.classList.contains("open")) return;   // never lower a row another popup is using
    wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); raiseChain(wrap, false);
  }
  function pick(date) {
    input.value = isoOf(date);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    sync(); close(); btn.focus();
  }

  btn.addEventListener("click", () => (wrap.classList.contains("open") ? close() : open(false)));
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (!wrap.classList.contains("open")) open(true); else { const t = pop.querySelector('.cal-day[tabindex="0"]'); if (t) t.focus(); } }
    else if (e.key === "Escape" && wrap.classList.contains("open")) { e.preventDefault(); close(); }
    else if (e.key === "Tab") close();
  });
  pop.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); return; }
    const cur = e.target.closest && e.target.closest(".cal-day");
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!cur || !step) return;
    e.preventDefault();
    const all = [...pop.querySelectorAll(".cal-day")];
    let i = all.indexOf(cur) + step;
    while (i >= 0 && i < all.length && all[i].disabled) i += step;
    if (i >= 0 && i < all.length) { cur.tabIndex = -1; all[i].tabIndex = 0; all[i].focus(); }
  });
  /* composedPath() is captured at click time, so re-rendering the month (which detaches the clicked arrow) no longer counts as an outside click */
  document.addEventListener("click", (e) => { if (!e.composedPath().includes(wrap)) close(); });
  document.addEventListener("select-open", (e) => { if (e.detail !== wrap) close(); });
  new MutationObserver(sync).observe(input, { attributes: true, attributeFilter: ["aria-invalid"] });
  sync();
  return { open: () => open(false), sync };
}

/* ---------- Custom dropdowns (keeps the native <select> in sync) ---------- */
function enhanceSelect(sel) {
  const NS = "http://www.w3.org/2000/svg";
  const icon = (cls, d) => {
    const s = document.createElementNS(NS, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none");
    s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "2");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true"); s.setAttribute("class", cls);
    const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); s.appendChild(p);
    return s;
  };

  const wrap = document.createElement("div");
  wrap.className = "select";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "select-btn";
  btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
  const label = document.createElement("span");
  label.className = "select-label";
  btn.append(label, icon("chev", "M6 9l6 6 6-6"));
  const list = document.createElement("ul");
  list.className = "select-list"; list.id = sel.id + "-list"; list.setAttribute("role", "listbox");
  btn.setAttribute("aria-controls", list.id);
  const lab = document.querySelector(`label[for="${sel.id}"]`);
  if (lab) { lab.id = lab.id || sel.id + "-label"; btn.setAttribute("aria-labelledby", lab.id); }
  wrap.append(btn, list);
  sel.insertAdjacentElement("afterend", wrap);
  sel.classList.add("sr-only");
  sel.tabIndex = -1;
  sel.setAttribute("aria-hidden", "true");
  sel.addEventListener("focus", () => btn.focus());   // label clicks and validation focus the visible button

  let active = -1;

  function build() {
    list.innerHTML = "";
    [...sel.options].forEach((o, i) => {
      const li = document.createElement("li");
      li.className = "select-opt"; li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === sel.selectedIndex));
      const txt = document.createElement("span"); txt.className = "txt";
      txt.textContent = o.textContent;
      if (o.dataset.hint) { const h = document.createElement("small"); h.textContent = o.dataset.hint; txt.appendChild(h); }
      li.append(txt, icon("tick", "M5 12.5l4.5 4.5L19 7.5"));
      li.addEventListener("mousedown", (e) => e.preventDefault());
      li.addEventListener("click", () => choose(i));
      li.addEventListener("mousemove", () => setActive(i));
      list.appendChild(li);
    });
    const cur = sel.options[sel.selectedIndex];
    label.textContent = cur ? cur.textContent : "";
    label.classList.toggle("placeholder", !sel.value);
    wrap.classList.toggle("disabled", sel.disabled);
    wrap.classList.toggle("invalid", sel.getAttribute("aria-invalid") === "true");
    btn.setAttribute("aria-disabled", String(sel.disabled));   // stays clickable so we can guide the user
    if (sel.disabled) close();
  }
  function setActive(i) {
    const items = [...list.children];
    if (!items.length) return;
    active = Math.max(0, Math.min(i, items.length - 1));
    items.forEach((el, idx) => el.classList.toggle("active", idx === active));
    items[active].scrollIntoView({ block: "nearest" });
  }
  function open() {
    if (sel.disabled) return;
    document.dispatchEvent(new CustomEvent("select-open", { detail: wrap }));
    wrap.classList.add("open"); btn.setAttribute("aria-expanded", "true");
    raiseChain(wrap, true);
    setActive(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
  }
  function close() {
    if (!wrap.classList.contains("open")) return;   // never lower a row another popup is using
    wrap.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); raiseChain(wrap, false);
  }
  function choose(i) {
    sel.selectedIndex = i;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    build(); close(); btn.focus();
  }

  btn.addEventListener("click", () => {
    if (sel.disabled) { sel.dispatchEvent(new CustomEvent("blocked")); return; }
    wrap.classList.contains("open") ? close() : open();
  });
  btn.addEventListener("keydown", (e) => {
    const isOpen = wrap.classList.contains("open");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) open(); else setActive(active + (e.key === "ArrowDown" ? 1 : -1));
    } else if ((e.key === "Enter" || e.key === " ") && isOpen) {
      e.preventDefault(); choose(active);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault(); close();
    } else if (e.key === "Tab") {
      close();
    }
  });
  document.addEventListener("click", (e) => { if (!e.composedPath().includes(wrap)) close(); });
  document.addEventListener("select-open", (e) => { if (e.detail !== wrap) close(); });

  new MutationObserver(build).observe(sel, { childList: true, attributes: true, attributeFilter: ["disabled", "aria-invalid"] });
  build();
  return { refresh: build };
}

/* ---------- Booking / call-back form (request-an-appointment page) ---------- */
(function () {
  const form = document.getElementById("lead-form");
  if (!form) return;

  const confirmBox = document.getElementById("confirm");
  const dateInput = document.getElementById("date");
  const timeSelect = document.getElementById("time");
  const whenFields = document.getElementById("when-fields");
  const submitBtn = document.getElementById("submit-btn");
  const tabs = [...document.querySelectorAll(".tab")];
  let mode = "book";

  const visitCtl = enhanceSelect(document.getElementById("visit"));
  const timeCtl = enhanceSelect(timeSelect);
  const datePicker = enhanceDate(dateInput, (d) => !(CLINIC.hours[d.getDay()] || []).length);
  /* Clicking the time field before a date is chosen opens the calendar and explains why */
  timeSelect.addEventListener("blocked", () => {
    if (!dateInput.value) setError("date", "date-err", "Please choose a date first.");
    setTimeout(() => datePicker.open(), 0);   // after this click finishes, so the outside-click handler doesn't close it again
  });

  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function parseDate(v) { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); }
  function fmtTime(h, m) {
    const suffix = h >= 12 ? "PM" : "AM";
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${suffix}`;
  }
  /* "0300 9813872", "3009813872" and "+92 300 9813872" all become "+92 300 9813872". Other country codes are kept. */
  function formatPhone(raw) {
    const v = raw.trim();
    let d = v.replace(/\D/g, "");
    if (v.startsWith("+") && !d.startsWith("92")) return v;
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("92") && d.length >= 12) d = d.slice(2);
    else if (d.startsWith("0")) d = d.slice(1);
    return `+92 ${d.slice(0, 3)} ${d.slice(3)}`.trim();
  }

  const now0 = new Date();
  const maxDate = new Date(); maxDate.setDate(now0.getDate() + CLINIC.bookAheadDays);
  dateInput.min = iso(now0);
  dateInput.max = iso(maxDate);

  function setMode(next, animate) {
    mode = next;
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === mode)));
    const isBook = mode === "book";
    whenFields.hidden = !isBook;
    document.getElementById("form-title").textContent = isBook ? "Book your appointment" : "Request a call back";
    document.getElementById("form-note").textContent = isBook
      ? "Choose a day and time. We’ll confirm by message."
      : "Leave your number and we’ll call you back during clinic hours.";
    submitBtn.querySelector(".label").textContent = isBook ? "Request appointment" : "Request a call back";
    document.getElementById("visit").closest(".field").hidden = !isBook;
    clearErrors();
    if (animate) { form.classList.remove("swap"); void form.offsetWidth; form.classList.add("swap"); }
  }
  tabs.forEach((t) => t.addEventListener("click", () => { if (t.dataset.mode !== mode) setMode(t.dataset.mode, true); }));

  function fillTimes() {
    timeSelect.innerHTML = "";
    document.getElementById("date-err").textContent = "";
    document.getElementById("time-err").textContent = "";
    dateInput.removeAttribute("aria-invalid");
    timeSelect.removeAttribute("aria-invalid");
    if (!dateInput.value) {
      timeSelect.disabled = true;
      timeSelect.innerHTML = '<option value="">Select a date first</option>';
      return;
    }
    const date = parseDate(dateInput.value);
    const ranges = CLINIC.hours[date.getDay()] || [];
    const now = new Date();
    const isToday = iso(date) === iso(now);
    const opts = [];
    ranges.forEach(([start, end]) => {
      for (let h = start; h < end; h++) {
        for (const m of [0, 30]) {
          if (isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()))) continue;
          opts.push([`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, fmtTime(h, m)]);
        }
      }
    });
    if (!opts.length) {
      timeSelect.disabled = true;
      timeSelect.innerHTML = '<option value="">No times available</option>';
      document.getElementById("date-err").textContent = ranges.length
        ? "No times left today. Choose another date."
        : "The clinic is closed on this day. Choose another date.";
      return;
    }
    timeSelect.disabled = false;
    timeSelect.innerHTML = '<option value="">Select a time</option>' +
      opts.map(([v, label]) => `<option value="${v}">${label}</option>`).join("");
  }
  dateInput.addEventListener("change", fillTimes);
  timeSelect.addEventListener("change", () => setError("time", "time-err", ""));
  ["name", "phone"].forEach((id) => document.getElementById(id).addEventListener("input", () => setError(id, id + "-err", "")));

  function setError(id, errId, msg) {
    const el = document.getElementById(id);
    document.getElementById(errId).textContent = msg;
    if (msg) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    return !msg;
  }
  function clearErrors() {
    ["name", "phone", "date", "time"].forEach((id) => {
      const e = document.getElementById(id + "-err");
      if (e) e.textContent = "";
      document.getElementById(id).removeAttribute("aria-invalid");
    });
  }

  function validate() {
    const bad = [];
    const name = document.getElementById("name").value.trim();
    const digits = document.getElementById("phone").value.replace(/\D/g, "");
    if (!setError("name", "name-err", name.length < 2 ? "Please enter your full name." : "")) bad.push("name");
    if (!setError("phone", "phone-err", digits.length < 10 ? "Please enter a phone number with at least 10 digits." : "")) bad.push("phone");
    if (mode === "book") {
      const dateMsg = !dateInput.value
        ? "Please choose a date."
        : (timeSelect.disabled ? document.getElementById("date-err").textContent : "");
      if (!setError("date", "date-err", dateMsg)) bad.push("date");
      if (dateInput.value && !timeSelect.disabled && !timeSelect.value) {
        setError("time", "time-err", "Please choose a time."); bad.push("time");
      } else {
        setError("time", "time-err", "");
      }
    }
    if (bad.length) { document.getElementById(bad[0]).focus(); return false; }
    return true;
  }

  function collectRows() {
    const rows = [["Request", mode === "book" ? "Appointment" : "Call back"]];
    if (mode === "book") rows.push(["Visit", document.getElementById("visit").value]);
    rows.push(["Name", document.getElementById("name").value.trim()]);
    rows.push(["Phone", formatPhone(document.getElementById("phone").value)]);
    if (document.getElementById("for-other").checked) rows.push(["Patient", "Child or family member"]);
    if (mode === "book") {
      rows.push(["Date", parseDate(dateInput.value).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })]);
      const [h, m] = timeSelect.value.split(":").map(Number);
      rows.push(["Time", fmtTime(h, m)]);
    }
    const msg = document.getElementById("message").value.trim();
    if (msg) rows.push(["Message", msg]);

    const isBook = mode === "book";
    const rowText = (key) => (rows.find((r) => r[0] === key) || ["", ""])[1];
    lastData = {
      type: isBook ? "appointment" : "callback",
      name: rowText("Name"),
      phone: rowText("Phone"),
      visit: isBook ? rowText("Visit") : "",
      dateText: isBook ? rowText("Date") : "",
      timeText: isBook ? rowText("Time") : "",
      forOther: document.getElementById("for-other").checked,
      message: msg,
      page: document.title,
      url: location.origin + location.pathname,
      referrer: cameFrom(),
      submittedAt: new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short", hour12: true }).replace(/b(am|pm)b/, (m) => m.toUpperCase()),
      hp: "",
    };
    return rows;
  }

  /* Where the visitor arrived from, shown in the alert email and the sheet */
  function cameFrom() {
    if (!document.referrer) return "Direct";
    try {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host === location.hostname) return "Homeo Heal website (internal)";
      if (/(^|\.)google\./.test(host)) return "Google Search";
      if (/(^|\.)bing\./.test(host)) return "Bing Search";
      if (/(^|\.)(facebook|fb)\./.test(host)) return "Facebook";
      if (/instagram\./.test(host)) return "Instagram";
      if (/(^|\.)(wa\.me|whatsapp\.)/.test(host)) return "WhatsApp";
      if (/youtube\.|youtu\.be/.test(host)) return "YouTube";
      return host;
    } catch (err) {
      return "Direct";
    }
  }

  function showSummary() {
    const rows = collectRows();
    const list = document.getElementById("summary");
    list.innerHTML = "";
    rows.forEach(([k, v]) => {
      const li = document.createElement("li");
      const a = document.createElement("span"), b = document.createElement("span");
      a.textContent = k; b.textContent = v;
      li.append(a, b);
      list.appendChild(li);
    });

    lastRows = rows;
    sendError.hidden = true;

    form.hidden = true;
    document.querySelector(".tabs").hidden = true;
    confirmBox.hidden = false;
    confirmBox.focus({ preventScroll: true });
    confirmBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (submitBtn.classList.contains("loading")) return;
    submitBtn.classList.add("loading");
    formError.hidden = true;

    if (mode === "callback") {
      /* a call back needs no review step: send everything now and show the thank-you screen */
      lastRows = collectRows();
      try {
        await sendRequest();
        form.hidden = true;
        document.querySelector(".tabs").hidden = true;
        showSuccess();
      } catch (err) {
        formError.hidden = false;
      } finally {
        submitBtn.classList.remove("loading");
      }
      return;
    }

    setTimeout(() => { submitBtn.classList.remove("loading"); showSummary(); }, 450);
  });

  document.getElementById("edit-btn").addEventListener("click", () => {
    confirmBox.hidden = true;
    form.hidden = false;
    document.querySelector(".tabs").hidden = false;
    form.classList.remove("swap"); void form.offsetWidth; form.classList.add("swap");
    document.getElementById("name").focus();
  });

  /* ---- Submit: email the request to the clinic, show a thank-you screen, then reset to a blank form ---- */
  const successBox = document.getElementById("success");
  const finalBtn = document.getElementById("submit-final");
  const sendError = document.getElementById("send-error");
  const formError = document.getElementById("form-error");
  let lastRows = [];
  let lastData = {};
  let countdownTimer = null;

  function buildPayload() {
    const data = {};
    lastRows.forEach(([k, v]) => { data[k] = v; });
    data["Submitted (Pakistan time)"] = new Date().toLocaleString("en-GB", { timeZone: "Asia/Karachi", dateStyle: "medium", timeStyle: "short", hour12: true }).replace(/b(am|pm)b/, (m) => m.toUpperCase());
    data._subject = `New ${mode === "book" ? "appointment" : "call back"} request: ${data.Name}`;
    data._template = "table";
    data._captcha = "false";
    data._honey = "";
    return data;
  }

  async function sendRequest() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      if (CLINIC.sheetEndpoint) {
        /* Google Apps Script: "text/plain" keeps this a simple request, so the browser sends no CORS preflight */
        const r = await fetch(CLINIC.sheetEndpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(lastData),
          signal: ctrl.signal,
        });
        const reply = await r.json().catch(() => ({}));
        if (!reply.ok) throw new Error(reply.error || "Request failed");
        return;
      }
      const res = await fetch(CLINIC.notifyEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(buildPayload()),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false || data.success === "false") throw new Error(data.message || "Request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  function resetAll() {
    clearInterval(countdownTimer);
    form.reset();
    dateInput.value = "";
    fillTimes();
    datePicker.sync();
    visitCtl.refresh();
    timeCtl.refresh();
    successBox.hidden = true;
    confirmBox.hidden = true;
    formError.hidden = true;
    sendError.hidden = true;
    form.hidden = false;
    document.querySelector(".tabs").hidden = false;
    setMode("book", true);
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    document.getElementById("book").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showSuccess() {
    const first = (lastRows.find((r) => r[0] === "Name") || ["", ""])[1].split(" ")[0];
    document.getElementById("success-title").textContent = first ? `Thank you, ${first}!` : "Thank you!";
    confirmBox.hidden = true;
    successBox.hidden = false;
    successBox.focus({ preventScroll: true });
    successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    let left = CLINIC.resetAfterSeconds;
    const note = document.getElementById("success-count");
    const paint = () => { note.textContent = `A fresh form will load in ${left} second${left === 1 ? "" : "s"}…`; };
    paint();
    countdownTimer = setInterval(() => {
      left -= 1;
      if (left <= 0) resetAll(); else paint();
    }, 1000);
  }

  finalBtn.addEventListener("click", async () => {
    if (finalBtn.classList.contains("loading")) return;
    sendError.hidden = true;
    finalBtn.classList.add("loading");
    try {
      await sendRequest();
      showSuccess();
    } catch (err) {
      sendError.hidden = false;
    } finally {
      finalBtn.classList.remove("loading");
    }
  });

  setMode(location.hash === "#callback" ? "callback" : "book", false);
  window.addEventListener("hashchange", () => {
    if (location.hash === "#callback") setMode("callback", true);
    else if (location.hash === "#book") setMode("book", true);
  });
})();
