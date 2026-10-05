/* OpenBiz site v2: contact form, in-page chat, WhatsApp button.
   Talks to the agent API (data-api on <body>). No build step, no libraries. */
(function () {
  "use strict";
  var body = document.body;
  var API = body.getAttribute("data-api") || "https://api.openbiz.co.il";
  if (location.hostname === "localhost" || location.hostname === "127.0.0.1") API = "http://localhost:8010"; // local agent during development
  var WA = body.getAttribute("data-whatsapp") || "";          // digits; empty = button hidden
  var LANG = document.documentElement.lang === "en" ? "en" : "he";
  var T = {
    he: { sending: "שולח…", sent: "תודה! קיבלנו את הפרטים, יגאל יחזור אליך בהקדם.", err: "משהו השתבש. נסה שוב, או כתוב לנו במייל.",
          busy: "קיבלנו הרבה בקשות. נסה שוב בעוד שעה.", typing: "הסוכן כותב…", wa: "היי, הגעתי מהאתר של OpenBiz" },
    en: { sending: "Sending…", sent: "Thanks! We got your details, Yigal will get back to you soon.", err: "Something went wrong. Try again, or email us.",
          busy: "Too many requests. Please try again in an hour.", typing: "The agent is typing…", wa: "Hi, I came from the OpenBiz website" }
  }[LANG];

  // ---- WhatsApp button: only when a number is configured
  var waLinks = document.querySelectorAll("[data-wa-link]");
  if (WA) {
    var href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(T.wa);
    waLinks.forEach(function (a) { a.href = href; a.hidden = false; });
  } else {
    waLinks.forEach(function (a) { a.hidden = true; });
  }

  // ---- Contact form
  var form = document.getElementById("lead-form");
  if (form) {
    var status = document.getElementById("lead-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; status.textContent = T.sending; status.className = "status";
      var data = {
        name: form.name.value.trim(), phone: form.phone.value.trim(),
        business_type: form.business_type.value.trim(), message: form.message.value.trim(),
        consent: form.consent.checked, website: form.website.value   // honeypot
      };
      fetch(API + "/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.ok) { status.textContent = T.sent; status.className = "status ok"; form.reset(); }
          else { status.textContent = res.s === 429 ? T.busy : (res.j && res.j.detail ? String(res.j.detail) : T.err); status.className = "status err"; }
        })
        .catch(function () { status.textContent = T.err; status.className = "status err"; })
        .then(function () { btn.disabled = false; });
    });
  }

  // ---- In-page chat
  var chat = document.getElementById("chat");
  if (!chat) return;
  var log = chat.querySelector(".chat-log"), input = chat.querySelector("input"), sendBtn = chat.querySelector("button");
  var session = null, pending = false;
  function add(cls, text) {
    var d = document.createElement("div"); d.className = "msg " + cls; d.textContent = text; log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function ensureSession() {
    if (session) return Promise.resolve(session);
    try { session = sessionStorage.getItem("openbiz-chat-session"); } catch (e) {}
    if (session) return Promise.resolve(session);
    return fetch(API + "/chat/session", { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
      session = j.session_id; try { sessionStorage.setItem("openbiz-chat-session", session); } catch (e) {}
      add("bot", j.welcome); return session;
    }).catch(function () { if (!log.children.length) add("bot", T.err); throw new Error("session"); });
  }
  function send() {
    var text = input.value.trim(); if (!text || pending) return;
    input.value = ""; add("me", text); pending = true;
    var typing = add("bot typing", T.typing);
    ensureSession().then(function (sid) {
      return fetch(API + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sid, text: text }) });
    }).then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) { typing.textContent = res.s === 429 ? T.busy : (res.j.reply || res.j.detail || T.err); typing.className = "msg bot"; })
      .catch(function () { typing.textContent = T.err; typing.className = "msg bot"; })
      .then(function () { pending = false; input.focus(); });
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  document.querySelectorAll("[data-open-chat]").forEach(function (b) {
    b.addEventListener("click", function (e) { e.preventDefault(); chat.scrollIntoView({ behavior: "smooth" }); ensureSession().then(function () { input.focus(); }); });
  });
  // Open the welcome line lazily when the chat scrolls into view
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries, obs) { if (entries[0].isIntersecting) { ensureSession(); obs.disconnect(); } }).observe(chat);
  }
})();
