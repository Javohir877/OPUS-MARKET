// ================= OPUS MARKET — scroll effektlari =================
// 1) Tepadagi o'qish progressi
// 2) "Elektr sxemasi": chap chetda plata yo'li chiziladi, elektron yuguradi va bo'limlarni "yoqadi"
// 3) Bosh sahifa parallaksi, brendlar qatorining tezlikka qarab qiyshayishi
// 4) Sarlavhalarning shifr kabi ochilishi
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = "http://www.w3.org/2000/svg";
  const CONTAINER = 1240;

  const bar = $("#scrollProgress i");
  const wrap = $("#circuitWrap");
  const heroText = $(".hero-text");
  const heroVisual = $(".hero-visual");
  const heroBg = $(".hero-bg");
  const marquee = $(".marquee");
  const track = $(".marquee-track");
  const marqueeAnim = track && track.getAnimations ? track.getAnimations()[0] : null;
  const sections = $$("[data-node]");

  // Har bir bo'lim tepasiga "nur" elementi
  sections.forEach((s) => {
    const b = document.createElement("i");
    b.className = "beam";
    s.prepend(b);
  });
  const power = (el) => el.classList.add("powered");

  // ---------- Elektr sxemasi ----------
  let enabled = false, active, glow, electron, total = 0, lut = [], nodes = [], cur = 0;

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };

  function build() {
    const vw = document.documentElement.clientWidth;
    const margin = (vw - CONTAINER) / 2;
    enabled = margin >= 56;
    wrap.hidden = !enabled;
    if (!enabled) { wrap.innerHTML = ""; return; }

    const footer = $("footer");
    const H = footer.getBoundingClientRect().bottom + scrollY;
    const x1 = Math.round(margin / 2) - 8;
    const x2 = x1 + 18;
    const labels = margin >= 150;

    // Yo'l nuqtalari: tugunlardan oldin 45° burilish (plata yo'li kabi)
    const pts = [[x1, 140]];
    let lane = x1;
    nodes = [];
    sections.forEach((s, i) => {
      const top = s.getBoundingClientRect().top + scrollY;
      const y = Math.max(top + 56, pts[pts.length - 1][1] + 40);
      const next = i % 2 ? x1 : x2;
      pts.push([lane, y - 40]);
      pts.push([next, y - 40 + Math.abs(next - lane)]);
      pts.push([next, y]);
      lane = next;
      nodes.push({ s, x: next, y, label: s.dataset.node, on: false });
    });
    pts.push([lane, H - 40]);
    const d = "M" + pts.map((p) => p.join(" ")).join(" L");

    wrap.innerHTML = "";
    wrap.style.height = H + "px";
    const svg = el("svg", { width: vw, height: H, viewBox: `0 0 ${vw} ${H}` }, wrap);
    const defs = el("defs", {}, svg);
    const grad = el("linearGradient", { id: "cxGrad", gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 0, y2: H }, defs);
    el("stop", { offset: "0", "stop-color": "#ff8a3d" }, grad);
    el("stop", { offset: "0.5", "stop-color": "#ff1f3d" }, grad);
    el("stop", { offset: "1", "stop-color": "#c00a22" }, grad);

    el("path", { d, class: "cx-base" }, svg);

    // Bo'limlarga qaragan tarmoqlar, kontaktlar va yozuvlar
    const ng = el("g", {}, svg);
    nodes.forEach((n) => {
      const g = el("g", { class: "cx-node" }, ng);
      const bx = Math.max(n.x + 24, margin - 10);
      el("line", { x1: n.x, y1: n.y, x2: bx, y2: n.y, class: "cx-branch" }, g);
      el("rect", { x: bx - 4, y: n.y - 4, width: 8, height: 8, rx: 1.5, class: "cx-pad" }, g);
      el("circle", { cx: n.x, cy: n.y, r: 9, class: "burst" }, g);
      el("circle", { cx: n.x, cy: n.y, r: 5.5, class: "ring" }, g);
      if (labels) {
        const t = el("text", { x: n.x + 14, y: n.y - 10, class: "cx-label" }, g);
        t.textContent = n.label.toUpperCase();
      }
      n.g = g;
    });

    glow = el("path", { d, class: "cx-glow" }, svg);
    active = el("path", { d, class: "cx-active" }, svg);
    electron = el("g", { class: "cx-electron" }, svg);
    el("circle", { r: 15, class: "cx-halo" }, electron);
    el("circle", { r: 4, class: "cx-core" }, electron);

    total = active.getTotalLength();
    [active, glow].forEach((p) => { p.style.strokeDasharray = total; p.style.strokeDashoffset = total; });

    // Uzunlik → y jadvali (yo'l faqat pastga yuradi, shuning uchun y o'sib boradi)
    lut = [];
    for (let l = 0; l <= total; l += 6) lut.push([l, active.getPointAtLength(l).y]);
    lut.push([total, active.getPointAtLength(total).y]);
    cur = lengthAt(scrollY + innerHeight * 0.55);
  }

  function lengthAt(y) {
    let lo = 0, hi = lut.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (lut[m][1] < y) lo = m + 1; else hi = m; }
    return lut[lo] ? lut[lo][0] : 0;
  }

  // Sxema bo'lmagan (tor) ekranlarda bo'limlar ko'ringanda yonadi
  const io = new IntersectionObserver((en) => en.forEach((e) => {
    if (e.isIntersecting && !enabled) { power(e.target); io.unobserve(e.target); }
  }), { threshold: 0.2 });
  sections.forEach((s) => io.observe(s));

  let rebuildT;
  const rebuild = () => { clearTimeout(rebuildT); rebuildT = setTimeout(build, 200); };
  addEventListener("resize", rebuild);
  if (window.ResizeObserver) new ResizeObserver(rebuild).observe(document.body);
  addEventListener("load", rebuild);
  build();

  // ---------- Asosiy sikl ----------
  let lastY = scrollY, vel = 0;
  function frame() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;

    // Tezlik (silliqlangan)
    vel += ((y - lastY) - vel) * 0.2;
    lastY = y;

    if (!reduce) {
      // Parallaks — faqat bosh sahifa ko'rinib turganda
      if (y < innerHeight * 1.3) {
        heroText && (heroText.style.translate = `0 ${y * 0.18}px`);
        heroVisual && (heroVisual.style.translate = `0 ${y * -0.07}px`);
        heroBg && (heroBg.style.translate = `0 ${y * 0.35}px`);
      }
      // Brendlar qatori: tez aylantirganda tezlashadi va qiyshayadi
      if (marquee) {
        const v = Math.max(-14, Math.min(14, vel * 0.35));
        marquee.style.transform = `skewY(${v * 0.12}deg) skewX(${-v}deg)`;
        if (marqueeAnim) marqueeAnim.playbackRate = 1 + Math.min(Math.abs(vel) * 0.12, 7);
      }
    }

    if (enabled && active) {
      const target = lengthAt(y + innerHeight * 0.55);
      cur = reduce ? target : cur + (target - cur) * 0.14;
      const off = total - cur;
      active.style.strokeDashoffset = off;
      glow.style.strokeDashoffset = off;
      const p = active.getPointAtLength(cur);
      electron.setAttribute("transform", `translate(${p.x} ${p.y})`);
      electron.classList.toggle("fast", Math.abs(target - cur) > 30);
      nodes.forEach((n) => {
        const on = p.y >= n.y - 1;
        if (on !== n.on) {
          n.on = on;
          n.g.classList.toggle("on", on);
          if (on) power(n.s);
        }
      });
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------- Sarlavhalarning "shifr" bo'lib ochilishi ----------
  const GLYPHS = "ABCDEFGHJKLMNOPQRSTUVWXYZ0123456789#%&$";
  function decode(h) {
    const final = h.textContent;
    if (!final.trim() || reduce) return;
    h.setAttribute("aria-label", final);
    const t0 = performance.now(), dur = 900, n = final.length;
    (function step(t) {
      const k = Math.min((t - t0) / dur, 1);
      const shown = Math.floor(k * n);
      let out = "";
      for (let i = 0; i < n; i++) {
        const c = final[i];
        out += i < shown || c === " " || c === "'" ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      h.textContent = out;
      if (k < 1) requestAnimationFrame(step);
      else { h.textContent = final; h.removeAttribute("aria-label"); }
    })(t0);
  }
  const hio = new IntersectionObserver((en) => en.forEach((e) => {
    if (e.isIntersecting) { decode(e.target); hio.unobserve(e.target); }
  }), { threshold: 0.6 });
  $$(".section-head h2").forEach((h) => hio.observe(h));
})();
