// ================= OPUS ADMIN — orqa fon animatsiyasi =================
// "Jonli tarmoq": suzuvchi nuqtalar, ular orasidagi chiziqlar va chiziqlar bo'ylab yuguruvchi "ma'lumot paketlari".
// Sichqoncha yaqinida nuqtalar unga intiladi. Tab yashirilsa to'xtaydi; "harakatni kamaytirish" yoqilsa — bitta qotgan kadr.
(() => {
  const cv = document.createElement("canvas");
  cv.className = "ad-bg-canvas";
  cv.setAttribute("aria-hidden", "true");
  document.body.prepend(cv);
  const aurora = document.createElement("div");
  aurora.className = "ad-aurora";
  aurora.setAttribute("aria-hidden", "true");
  aurora.innerHTML = "<i></i><i></i><i></i>";
  document.body.prepend(aurora);

  const ctx = cv.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  let W = 0, H = 0, nodes = [], packets = [], mouse = { x: -9999, y: -9999 }, last = 0, raf = 0;
  const LINK = 150;

  const dark = () => document.documentElement.dataset.theme !== "light";
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(90, Math.max(28, (W * H) / 16000)));
    nodes = Array.from({ length: count }, () => ({
      x: rand(0, W), y: rand(0, H), vx: rand(-0.18, 0.18), vy: rand(-0.18, 0.18),
      r: rand(1.2, 2.6), hue: rand(350, 385) % 360, pulse: rand(0, Math.PI * 2),
    }));
    packets = [];
  }

  function step(t) {
    // Sahifa ko'rinmay turib ochilgan bo'lsa (o'lcham 0), o'lchamni qayta olamiz
    if (W !== innerWidth || H !== innerHeight) resize();
    const dt = Math.min(50, t - last || 16) / 16; last = t;
    ctx.clearRect(0, 0, W, H);
    const isDark = dark();
    const lineA = isDark ? 0.16 : 0.1, dotA = isDark ? 0.75 : 0.45;

    // Harakat va sichqonchaga intilish
    for (const n of nodes) {
      const dx = mouse.x - n.x, dy = mouse.y - n.y, d2 = dx * dx + dy * dy;
      if (d2 < 200 * 200) { const k = 0.012 * (1 - Math.sqrt(d2) / 200); n.vx += dx * k * 0.02; n.vy += dy * k * 0.02; }
      n.vx *= 0.985; n.vy *= 0.985;
      const sp = Math.hypot(n.vx, n.vy);
      if (sp < 0.08) { n.vx += rand(-0.02, 0.02); n.vy += rand(-0.02, 0.02); }
      n.x += n.vx * dt; n.y += n.vy * dt; n.pulse += 0.03 * dt;
      if (n.x < -20) n.x = W + 20; if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; if (n.y > H + 20) n.y = -20;
    }

    // Chiziqlar
    const links = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        const near = Math.hypot((a.x + b.x) / 2 - mouse.x, (a.y + b.y) / 2 - mouse.y) < 160;
        ctx.strokeStyle = `rgba(255, ${near ? 90 : 40}, ${near ? 70 : 60}, ${lineA * (1 - d / LINK) * (near ? 2.6 : 1)})`;
        ctx.lineWidth = near ? 1.2 : 0.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        links.push([a, b]);
      }
    }

    // Ma'lumot paketlari (chiziq bo'ylab yuguradigan yorug' nuqta)
    if (links.length && packets.length < 10 && Math.random() < 0.06 * dt) {
      const [a, b] = links[(Math.random() * links.length) | 0];
      packets.push({ a, b, p: 0, s: rand(0.012, 0.03) });
    }
    packets = packets.filter((k) => (k.p += k.s * dt) < 1);
    for (const k of packets) {
      const x = k.a.x + (k.b.x - k.a.x) * k.p, y = k.a.y + (k.b.y - k.a.y) * k.p;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
      g.addColorStop(0, `rgba(255, 190, 120, ${isDark ? 0.95 : 0.7})`);
      g.addColorStop(1, "rgba(255, 60, 60, 0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
    }

    // Nuqtalar (yengil "nafas olish" bilan)
    for (const n of nodes) {
      const a = dotA * (0.6 + 0.4 * Math.sin(n.pulse));
      ctx.fillStyle = `hsla(${n.hue}, 95%, 60%, ${a})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduce) raf = requestAnimationFrame(step);
  }

  addEventListener("resize", () => { resize(); if (reduce) step(0); });
  addEventListener("pointermove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });
  document.addEventListener("visibilitychange", () => {
    if (reduce) return;
    cancelAnimationFrame(raf);
    if (!document.hidden) { last = 0; raf = requestAnimationFrame(step); }
  });
  resize();
  if (reduce) step(0); else raf = requestAnimationFrame(step);
})();
