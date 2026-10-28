/**
 * Homeo Heal — website form intake (Google Apps Script)
 *
 * Paste this into Extensions > Apps Script of the Google Sheet that should store the requests.
 * It receives the website's appointment and call-back forms, saves each one to its own tab,
 * and sends a branded email alert to the Google account that owns the script.
 *
 * Tabs created automatically:  "Appointments"  and  "Call Backs".
 */

const CONFIG = {
  SHEET_ID: "",                                   // leave empty if this script was opened from the sheet (Extensions > Apps Script).
                                                  // Otherwise paste the sheet's ID: the long text between /d/ and /edit in its address.
  ALERT_TO: "",                                   // leave empty to alert the Google account that owns this script
  SITE_NAME: "Homeo Heal",
  TAGLINE: "Individual care, natural approach",
  SITE_URL: "https://homeo-heal.pages.dev",
  LOGO_URL: "https://homeo-heal.pages.dev/assets/images/logo-email.png",
  BRAND_COLOR: "#3A5C66",
  APPOINTMENT_TAB: "Appointments",
  CALLBACK_TAB: "Call Backs",
};

const HEADERS = {
  appointment: ["Received (PKT)", "Name", "Phone", "Visit Type", "Preferred Date", "Preferred Time", "For Child / Family", "Message", "Came From", "Page", "Status"],
  callback: ["Received (PKT)", "Name", "Phone", "For Child / Family", "Message", "Came From", "Page", "Status"],
};

/** Website calls this (POST). */
function doPost(e) {
  let d;
  try {
    d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return reply({ ok: false, error: "Bad request" });
  }

  if (d.hp) return reply({ ok: true });                                   // honeypot: silently ignore bots

  d = clean(d);
  if (d.type !== "appointment" && d.type !== "callback") return reply({ ok: false, error: "Unknown form" });
  if (d.name.length < 2 || d.phone.replace(/\D/g, "").length < 10) return reply({ ok: false, error: "Missing name or phone" });

  let savedToSheet = false;
  let emailed = false;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    saveRow(d);
    savedToSheet = true;
  } catch (err) {
    console.error("Sheet error: " + err);
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* not held */ }
  }

  try {
    sendAlert(d);
    emailed = true;
  } catch (err) {
    console.error("Email error: " + err);
  }

  if (!savedToSheet && !emailed) return reply({ ok: false, error: "Could not save the request" });
  return reply({ ok: true, savedToSheet: savedToSheet, emailed: emailed });
}

/** Opening the web app URL in a browser just confirms it is live. */
function doGet() {
  return reply({ ok: true, service: CONFIG.SITE_NAME + " form endpoint" });
}

/* ---------- Sheet ---------- */

function saveRow(d) {
  const isAppt = d.type === "appointment";
  const sheet = getTab(isAppt ? CONFIG.APPOINTMENT_TAB : CONFIG.CALLBACK_TAB, HEADERS[d.type]);
  const forWho = d.forOther ? "Child / family member" : "Self";
  const row = isAppt
    ? [d.submittedAt, d.name, d.phone, d.visit, d.dateText, d.timeText, forWho, d.message, d.referrer, d.page, "New"]
    : [d.submittedAt, d.name, d.phone, forWho, d.message, d.referrer, d.page, "New"];
  sheet.appendRow(row);
}

function getSpreadsheet() {
  const ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("No spreadsheet found. Paste the sheet's ID into CONFIG.SHEET_ID.");
  return ss;
}

function getTab(name, headers) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight("bold").setFontColor("#ffffff").setBackground(CONFIG.BRAND_COLOR);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 3, 500, 1).setNumberFormat("@");                    // keep phone numbers as text
    sheet.setColumnWidths(1, headers.length, 150);
  }
  return sheet;
}

/** Optional: run once from the editor to create both tabs before the first real request. */
function setup() {
  getTab(CONFIG.APPOINTMENT_TAB, HEADERS.appointment);
  getTab(CONFIG.CALLBACK_TAB, HEADERS.callback);
}

/* ---------- Email ---------- */

function sendAlert(d) {
  const isAppt = d.type === "appointment";
  const to = CONFIG.ALERT_TO || Session.getEffectiveUser().getEmail();
  const subject = (isAppt ? "📅 New Appointment Request" : "📞 New Call Back Request") +
    " — " + d.name + " | " + CONFIG.SITE_NAME;
  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: alertHtml(d),
    body: alertText(d),
    name: CONFIG.SITE_NAME + " Website",
  });
}

function alertText(d) {
  const lines = [
    d.type === "appointment" ? "New appointment request" : "New call back request",
    "Name: " + d.name,
    "Phone: " + d.phone,
  ];
  if (d.forOther) lines.push("For: Child / family member");
  if (d.type === "appointment") lines.push("Visit type: " + d.visit, "Preferred date: " + d.dateText, "Preferred time: " + d.timeText);
  if (d.message) lines.push("Message: " + d.message);
  lines.push("Came from: " + d.referrer, "Page: " + d.url, "Received: " + d.submittedAt);
  return lines.join("\n");
}

function alertHtml(d) {
  const isAppt = d.type === "appointment";
  const brand = CONFIG.BRAND_COLOR;
  const digits = d.phone.replace(/\D/g, "");
  const h = function (text) {
    return '<h3 style="margin:22px 0 8px;font-size:17px;color:' + brand + ';border-bottom:1px solid #e3e3e3;padding-bottom:6px;font-family:Arial,Helvetica,sans-serif;">' + esc(text) + "</h3>";
  };
  const line = function (label, valueHtml) {
    return '<p style="margin:7px 0;font-size:14px;line-height:1.5;color:#222;font-family:Arial,Helvetica,sans-serif;"><b>' + esc(label) + ":</b> " + valueHtml + "</p>";
  };
  const btn = function (href, text, bg) {
    return '<a href="' + esc(href) + '" style="display:inline-block;margin:6px 8px 0 0;padding:10px 18px;border-radius:6px;background:' + bg + ';color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">' + text + "</a>";
  };

  let body = "";
  body += '<p style="margin:0 0 4px;font-size:14px;line-height:1.5;color:#222;font-family:Arial,Helvetica,sans-serif;">' +
    (isAppt ? "📅" : "📞") + " Someone submitted " + (isAppt ? "an <b>appointment request</b>" : "a <b>call back request</b>") +
    " on the " + esc(CONFIG.SITE_NAME) + " website.</p>";

  body += h("Patient Details");
  body += line("Name", esc(d.name));
  body += line("Phone", '<a href="tel:' + esc("+" + digits) + '" style="color:#1a5fb4;">' + esc(d.phone) + "</a>");
  if (d.forOther) body += line("For", "Child / family member");

  if (isAppt) {
    body += h("Appointment");
    body += line("Visit Type", esc(d.visit));
    body += line("Preferred Date", esc(d.dateText));
    body += line("Preferred Time", esc(d.timeText));
  }

  if (d.message) {
    body += h("Message");
    body += '<p style="margin:7px 0;padding:10px 12px;background:#f4f8f9;border-left:3px solid ' + brand + ';font-size:14px;line-height:1.6;color:#222;font-family:Arial,Helvetica,sans-serif;">' + esc(d.message).replace(/\n/g, "<br>") + "</p>";
  }

  body += h("Where");
  body += line("Page", esc(d.page));
  body += line("Came From", esc(d.referrer));
  body += line("Link", '<a href="' + esc(d.url) + '" style="color:#1a5fb4;">' + esc(d.url) + "</a>");

  body += '<div style="margin-top:20px;">' + btn("tel:+" + digits, "📞 Call " + esc(d.name.split(" ")[0]), brand) +
    btn("https://wa.me/" + digits, "💬 WhatsApp", "#25a244") + "</div>";

  body += '<hr style="border:0;border-top:1px solid #e3e3e3;margin:24px 0 12px;">' +
    '<p style="margin:0;font-size:12px;line-height:1.5;color:#888;font-family:Arial,Helvetica,sans-serif;">Received: ' + esc(d.submittedAt) + "<br>" +
    "(This alert was sent automatically from the " + esc(CONFIG.SITE_NAME) + " website.)</p>";

  return '<div style="max-width:540px;margin:0;font-family:Arial,Helvetica,sans-serif;">' +
    '<div style="background:' + brand + ';border-radius:12px 12px 0 0;padding:26px 20px;text-align:center;">' +
    '<img src="' + esc(CONFIG.LOGO_URL) + '" width="56" height="56" alt="" style="display:block;margin:0 auto 12px;border:0;">' +
    '<div style="font-size:24px;font-weight:bold;letter-spacing:1px;color:#ffffff;">' + esc(CONFIG.SITE_NAME) + "</div>" +
    '<div style="margin-top:6px;font-size:12px;color:#dfecef;">' + esc(CONFIG.TAGLINE) + "</div></div>" +
    '<div style="padding:18px 18px 8px;border:1px solid #e3e3e3;border-top:0;border-radius:0 0 12px 12px;">' + body + "</div></div>";
}

/* ---------- helpers ---------- */

function clean(d) {
  const s = function (v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max || 300); };
  return {
    type: s(d.type, 20),
    name: s(d.name, 120),
    phone: s(d.phone, 40),
    visit: s(d.visit, 80),
    dateText: s(d.dateText, 80),
    timeText: s(d.timeText, 40),
    forOther: d.forOther === true || d.forOther === "true",
    message: String(d.message == null ? "" : d.message).trim().slice(0, 2000),
    page: s(d.page, 200),
    url: s(d.url, 500),
    referrer: s(d.referrer, 200) || "Direct",
    submittedAt: s(d.submittedAt, 60),
    hp: s(d.hp, 50),
  };
}

function esc(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
