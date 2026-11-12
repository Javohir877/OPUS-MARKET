// OPUS MARKET — chiroyli ochiladigan ro'yxat (oddiy <select> o'rniga).
// Asl <select> joyida qoladi (joylashuv, forma, qiymat va "change" hodisasi avvalgidek) — faqat ko'rinishi bezatiladi
// va bosilganda tizimning oddiy ro'yxati o'rniga chiroyli panel ochiladi:
// kompyuterda — ro'yxat ostida, telefonda — pastdan chiqadigan oyna. Klaviatura: ↑ ↓ Enter Esc, harf bilan qidirish.
// O'chirish: <select data-native>.
(function () {
  if (window.__opusSelect) return;
  window.__opusSelect = true;
  let openUI = null;
  const small = () => matchMedia("(max-width: 640px)").matches;
  const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function enhance(sel) {
    if (sel._os || sel.multiple || sel.size > 1 || sel.hasAttribute("data-native") || sel.closest("[data-native]")) return;
    sel._os = true;
    sel.classList.add("os-sel");
    // Tizim ro'yxati ochilmasin — o'rniga bizniki
    sel.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || sel.disabled) return;
      e.preventDefault();
      sel.focus({ preventScroll: true });
      openUI && openUI.sel === sel ? close() : open(sel);
    });
    sel.addEventListener("touchstart", (e) => { if (!sel.disabled) e.preventDefault(); }, { passive: false });
    sel.addEventListener("mousedown", (e) => e.preventDefault());
    sel.addEventListener("keydown", (e) => {
      if (openUI && openUI.sel === sel) return; // ochiq bo'lsa — panel boshqaradi
      if (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown") || e.key === "F4") { e.preventDefault(); open(sel); }
    });
  }

  function open(sel) {
    close(true);
    const opts = [...sel.options];
    const sheet = small();
    const pop = document.createElement("div");
    pop.className = "os-pop" + (sheet ? " sheet" : "");
    pop.setAttribute("role", "listbox");
    const lab = sel.getAttribute("aria-label") || (sel.id && document.querySelector(`label[for="${CSS.escape(sel.id)}"]`)?.textContent) || "";
    pop.innerHTML = (sheet ? `<div class="os-grip"></div>${lab ? `<div class="os-title">${escH(lab.trim())}</div>` : ""}` : "") + `<div class="os-list"></div>`;
    const list = pop.querySelector(".os-list");
    opts.forEach((o, i) => {
      if (o.hidden) return;
      const it = document.createElement("div");
      it.className = "os-opt" + (o.selected ? " on" : "") + (o.disabled ? " off" : "");
      it.setAttribute("role", "option");
      it.setAttribute("aria-selected", o.selected ? "true" : "false");
      it.dataset.i = i;
      it.innerHTML = `<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
      it.firstChild.textContent = o.textContent;
      it.style.animationDelay = Math.min(i, 10) * 14 + "ms";
      list.appendChild(it);
    });
    let bg = null;
    if (sheet) { bg = document.createElement("div"); bg.className = "os-bg"; document.body.appendChild(bg); bg.addEventListener("click", () => close()); }
    document.body.appendChild(pop);
    if (!sheet) {
      // Ro'yxat ostida (joy yetmasa — ustida); kengligi ro'yxatdan kichik emas
      const r = sel.getBoundingClientRect();
      pop.style.minWidth = Math.max(r.width, 180) + "px";
      const ph = Math.min(pop.offsetHeight, 344), below = innerHeight - r.bottom - 12, up = below < ph && r.top > below;
      pop.style.left = Math.min(Math.max(8, r.left), innerWidth - pop.offsetWidth - 8) + "px";
      pop.style.top = (up ? r.top - ph - 6 : r.bottom + 6) + "px";
      pop.classList.toggle("up", up);
    }
    sel.classList.add("os-open");
    sel.setAttribute("aria-expanded", "true");
    const items = () => [...list.children].filter((x) => !x.classList.contains("off"));
    const mark = (el) => { list.querySelectorAll(".os-opt.kb").forEach((x) => x.classList.remove("kb")); if (el) { el.classList.add("kb"); el.scrollIntoView({ block: "nearest" }); } };
    const pick = (el) => {
      if (!el || el.classList.contains("off")) return;
      const i = +el.dataset.i;
      if (sel.selectedIndex !== i) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event("input", { bubbles: true }));
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
      try { window.SFX && SFX.play("select"); } catch (er) {}
      close();
      sel.focus({ preventScroll: true });
    };
    list.addEventListener("click", (e) => pick(e.target.closest(".os-opt")));
    const on = list.querySelector(".os-opt.on"); if (on) requestAnimationFrame(() => on.scrollIntoView({ block: "center" }));
    let typed = "", typedT = 0;
    const key = (e) => {
      const L = items(), k = L.indexOf(list.querySelector(".os-opt.kb") || list.querySelector(".os-opt.on"));
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); sel.focus(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); mark(L[Math.min(L.length - 1, k + 1)]); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); mark(L[Math.max(0, k - 1)]); return; }
      if (e.key === "Home") { e.preventDefault(); mark(L[0]); return; }
      if (e.key === "End") { e.preventDefault(); mark(L[L.length - 1]); return; }
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(list.querySelector(".os-opt.kb") || list.querySelector(".os-opt.on")); return; }
      if (e.key === "Tab") { close(); return; }
      if (e.key.length === 1) { e.preventDefault(); clearTimeout(typedT); typed += e.key.toLowerCase(); typedT = setTimeout(() => (typed = ""), 600); const m = L.find((x) => x.textContent.trim().toLowerCase().startsWith(typed)); if (m) mark(m); }
    };
    document.addEventListener("keydown", key, true);
    const away = (e) => { if (!pop.contains(e.target) && e.target !== sel) close(); };
    setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
    const reflow = () => close();
    const onScroll = (e) => { if (!pop.contains(e.target)) close(); };
    addEventListener("resize", reflow);
    if (!sheet) addEventListener("scroll", onScroll, true);
    openUI = { sel, pop, bg, cleanup: () => { document.removeEventListener("keydown", key, true); document.removeEventListener("pointerdown", away, true); removeEventListener("resize", reflow); removeEventListener("scroll", onScroll, true); } };
    requestAnimationFrame(() => { pop.classList.add("show"); if (bg) bg.classList.add("show"); });
  }

  function close(instant) {
    if (!openUI) return;
    const { sel, pop, bg, cleanup } = openUI;
    openUI = null;
    cleanup();
    sel.classList.remove("os-open");
    sel.setAttribute("aria-expanded", "false");
    pop.classList.remove("show"); if (bg) bg.classList.remove("show");
    const rm = () => { pop.remove(); if (bg) bg.remove(); };
    if (instant) rm(); else setTimeout(rm, 220);
  }

  const scan = (root) => { if (root.tagName === "SELECT") enhance(root); else if (root.querySelectorAll) root.querySelectorAll("select").forEach(enhance); };
  const start = () => {
    scan(document);
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); }))).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
