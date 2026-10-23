// OPUS MARKET — ovoz effektlari (Web Audio API bilan sintez qilinadi: fayl yuklanmaydi, sayt og'irlashmaydi).
// SFX.play("add") — chaqirish; SFX.toggle() — o'chirish/yoqish (localStorage "opus_sound" da eslab qolinadi).
(function () {
  let ctx = null, master = null;
  let on = true;
  try { on = localStorage.getItem("opus_sound") !== "0"; } catch {}

  // Brauzer ovozni faqat foydalanuvchi biror narsani bosgandan keyin ruxsat beradi
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor(); // baland ovozlar qulog'ni og'ritmasin
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Bitta nota: chastota, boshlanish (s), davomiylik (s), to'lqin turi, balandlik, chastota siljishi
  function tone(f, t0, dur, type = "sine", vol = 0.2, slideTo) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // Shovqin (shitirlash) — "whoosh" uchun
  function noise(t0, dur, vol = 0.12, from = 2400, to = 500) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + t0, len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    flt.type = "bandpass"; flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(from, t); flt.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(master);
    src.start(t); src.stop(t + dur);
  }

  const SOUNDS = {
    click:   () => tone(1800, 0, 0.035, "triangle", 0.06),
    tick:    () => tone(2400, 0, 0.025, "square", 0.025),
    hover:   () => tone(3200, 0, 0.02, "sine", 0.018),
    add:     () => { tone(660, 0, 0.09, "triangle", 0.16, 990); tone(1320, 0.07, 0.16, "sine", 0.12); tone(1980, 0.12, 0.2, "sine", 0.06); },
    remove:  () => { tone(520, 0, 0.12, "triangle", 0.12, 260); noise(0, 0.12, 0.05, 1200, 300); },
    plus:    () => tone(1100, 0, 0.06, "triangle", 0.09, 1400),
    minus:   () => tone(800, 0, 0.06, "triangle", 0.09, 600),
    open:    () => { noise(0, 0.22, 0.07, 600, 2600); tone(440, 0.02, 0.18, "sine", 0.05, 660); },
    close:   () => { noise(0, 0.18, 0.05, 2400, 500); },
    toggle:  () => { tone(900, 0, 0.05, "square", 0.04); tone(1350, 0.05, 0.07, "square", 0.035); },
    success: () => [523, 659, 784, 1047].forEach((f, i) => { tone(f, i * 0.09, 0.32, "triangle", 0.14); tone(f * 2, i * 0.09, 0.2, "sine", 0.04); }),
    error:   () => { tone(220, 0, 0.14, "sawtooth", 0.07, 180); tone(196, 0.13, 0.2, "sawtooth", 0.07, 150); },
    notify:  () => { tone(1320, 0, 0.1, "sine", 0.1); tone(1760, 0.09, 0.16, "sine", 0.09); },
    coin:    () => { tone(988, 0, 0.08, "square", 0.06); tone(1319, 0.07, 0.25, "square", 0.06); },
  };

  // Bir xil ovoz ketma-ket juda tez chalinmasin (masalan, sichqoncha tez yurganda)
  const last = {};
  function play(name) {
    if (!on || !SOUNDS[name] || document.hidden) return;
    const now = performance.now();
    if (now - (last[name] || 0) < (name === "hover" ? 70 : 40)) return;
    last[name] = now;
    try { SOUNDS[name](); } catch {}
  }
  function set(v) {
    on = v;
    try { localStorage.setItem("opus_sound", v ? "1" : "0"); } catch {}
    document.documentElement.classList.toggle("sound-off", !v);
    if (v) { ac(); play("toggle"); }
  }
  document.documentElement.classList.toggle("sound-off", !on);
  window.SFX = { play, toggle: () => set(!on), get on() { return on; } };
})();
