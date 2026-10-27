// OPUS MARKET — ovoz effektlari (Web Audio API bilan sintez qilinadi: fayl yuklanmaydi, sayt og'irlashmaydi).
//  • SFX.play("add") — ovoz chalish
//  • Sahifadagi HAR BIR tugma, havola, tanlov, belgi va slayder avtomatik o'z ovozini oladi (pastdagi QOIDALAR).
//    Elementga data-sfx="nomi" yozib ovozni tanlash, data-sfx="none" bilan o'chirish mumkin.
//  • SFX.skip(selector) — o'z ovozini kodda chaladigan elementlar (masalan "Savatga" tugmasi) uchun avtomatik ovozni o'chiradi.
//  • Sozlamalar (yoqilgan, balandlik, tebranish) localStorage'da: opus_sound, opus_sound_vol, opus_haptic.
(function () {
  const ls = {
    get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  let ctx = null, master = null;
  let on = ls.get("opus_sound", "1") !== "0";
  let vol = Math.min(1, Math.max(0, +ls.get("opus_sound_vol", "0.6")));
  let haptic = ls.get("opus_haptic", "1") !== "0";

  // Brauzer ovozni faqat foydalanuvchi biror narsani bosgandan keyin ruxsat beradi
  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      const comp = ctx.createDynamicsCompressor(); // baland ovozlar quloqni og'ritmasin
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Hozir chalinayotgan ovozlar (har biri alohida gain "bus"da) — kerak bo'lsa birdan so'ndirish uchun
  let bus = null;
  const voices = new Set();
  function silenceOthers() {
    const c = ctx; if (!c) return;
    for (const g of voices) { try { g.gain.cancelScheduledValues(c.currentTime); g.gain.setTargetAtTime(0, c.currentTime, 0.02); } catch {} }
    voices.clear();
  }
  // Bitta nota: chastota, boshlanish (s), davomiylik (s), to'lqin turi, balandlik, chastota siljishi
  function tone(f, t0, dur, type = "sine", v = 0.2, slideTo) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + t0, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.012, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  // Shovqin (shitirlash) — "whoosh" uchun
  function noise(t0, dur, v = 0.12, from = 2400, to = 500) {
    const c = ac(); if (!c) return;
    const t = c.currentTime + t0, len = Math.ceil(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf;
    flt.type = "bandpass"; flt.Q.value = 1.2;
    flt.frequency.setValueAtTime(from, t); flt.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(bus || master);
    src.start(t); src.stop(t + dur);
  }

  // [ovoz, tebranish (ms yoki naqsh)]
  const SOUNDS = {
    click:   [() => { tone(1500, 0, 0.045, "triangle", 0.11); tone(3000, 0, 0.02, "sine", 0.03); }, 8],
    icon:    [() => { tone(880, 0, 0.06, "triangle", 0.12, 1180); }, 8],
    link:    [() => { tone(1250, 0, 0.05, "sine", 0.09, 1650); }, 0],
    nav:     [() => { noise(0, 0.08, 0.03, 3000, 1500); tone(1046, 0, 0.07, "sine", 0.09); tone(1568, 0.035, 0.09, "sine", 0.06); }, 6],
    chip:    [() => { tone(700, 0, 0.07, "sine", 0.13, 1400); }, 6],
    tab:     [() => { tone(1175, 0, 0.05, "triangle", 0.09); tone(1760, 0.04, 0.06, "triangle", 0.07); }, 6],
    next:    [() => { tone(784, 0, 0.07, "triangle", 0.12); tone(1175, 0.06, 0.1, "triangle", 0.11); }, 10],
    back:    [() => { tone(1175, 0, 0.07, "triangle", 0.1); tone(784, 0.06, 0.1, "triangle", 0.09); }, 10],
    submit:  [() => { tone(659, 0, 0.09, "triangle", 0.13); tone(988, 0.07, 0.11, "triangle", 0.12); tone(1319, 0.14, 0.18, "sine", 0.1); }, [10, 30, 10]],
    select:  [() => { tone(988, 0, 0.05, "sine", 0.11); tone(1480, 0.045, 0.08, "sine", 0.08); }, 8],
    checkOn: [() => { tone(1200, 0, 0.05, "square", 0.05, 1800); }, 8],
    checkOff:[() => { tone(1200, 0, 0.05, "square", 0.05, 800); }, 6],
    danger:  [() => { tone(330, 0, 0.09, "square", 0.07); tone(247, 0.08, 0.14, "square", 0.07); }, [20, 40, 20]],
    tick:    [() => tone(2400, 0, 0.025, "square", 0.03), 0],
    hover:   [() => tone(3200, 0, 0.02, "sine", 0.02), 0],
    add:     [() => { tone(660, 0, 0.09, "triangle", 0.16, 990); tone(1320, 0.07, 0.16, "sine", 0.12); tone(1980, 0.12, 0.2, "sine", 0.06); }, 15],
    remove:  [() => { tone(520, 0, 0.12, "triangle", 0.12, 260); noise(0, 0.12, 0.05, 1200, 300); }, 15],
    plus:    [() => tone(1100, 0, 0.06, "triangle", 0.1, 1400), 6],
    minus:   [() => tone(800, 0, 0.06, "triangle", 0.1, 600), 6],
    open:    [() => { noise(0, 0.22, 0.07, 600, 2600); tone(440, 0.02, 0.18, "sine", 0.05, 660); }, 0],
    close:   [() => noise(0, 0.18, 0.05, 2400, 500), 0],
    toggle:  [() => { tone(900, 0, 0.05, "square", 0.04); tone(1350, 0.05, 0.07, "square", 0.035); }, 8],
    check:   [() => {
      tone(392, 0, 0.55, "sine", 0.05, 784);                 // doira chizilmoqda
      noise(0.05, 0.5, 0.025, 800, 3200);
      tone(1046.5, 0.62, 0.55, "sine", 0.17);                 // galochka — asosiy "ding"
      tone(1568, 0.62, 0.45, "sine", 0.07);
      tone(2093, 0.66, 0.35, "triangle", 0.04);
      [2637, 3136, 3951].forEach((f, i) => tone(f, 0.8 + i * 0.06, 0.18, "sine", 0.025)); // yaltirash
    }, [0, 600, 30]],
    ok:      [() => { tone(1046.5, 0, 0.25, "sine", 0.12); tone(1568, 0.02, 0.22, "sine", 0.05); }, 12],
    success: [() => [523, 659, 784, 1047].forEach((f, i) => { tone(f, i * 0.09, 0.32, "triangle", 0.14); tone(f * 2, i * 0.09, 0.2, "sine", 0.04); }), [20, 50, 20, 50, 40]],
    error:   [() => { tone(220, 0, 0.14, "sawtooth", 0.07, 180); tone(196, 0.13, 0.2, "sawtooth", 0.07, 150); }, [40, 60, 40]],
    notify:  [() => { tone(1320, 0, 0.1, "sine", 0.1); tone(1760, 0.09, 0.16, "sine", 0.09); }, 20],
    coin:    [() => { tone(988, 0, 0.08, "square", 0.06); tone(1319, 0.07, 0.25, "square", 0.06); }, 0],
  };

  SOUNDS.confetti = SOUNDS.success;

  // ---------- Yozib olingan ovozlar (sounds/*.mp3, myinstants.com) ----------
  // Har bir effekt: [fayl, balandlik, eng uzun davomiyligi (s)] — uzun ovozlar silliq qisqartiriladi.
  // Fayl hali yuklanmagan bo'lsa yoki yuklanmasa — yuqoridagi sintez ovoz chalinadi.
  const SAMPLES = {
    click: ["click", 0.55, 0.3], icon: ["click", 0.5, 0.3], link: ["click", 0.45, 0.3], toggle: ["click", 0.5, 0.3], submit: ["click", 0.6, 0.3],
    nav: ["open", 0.45, 0.45], next: ["open", 0.45, 0.45], open: ["open", 0.4, 0.5],
    back: ["close", 0.45, 0.45], close: ["close", 0.4, 0.45],
    tab: ["tab", 0.6, 0.35], chip: ["pop", 0.7, 0.3], select: ["pop", 0.6, 0.3], checkOn: ["pop", 0.7, 0.3], plus: ["pop", 0.55, 0.25], minus: ["pop", 0.45, 0.25],
    add: ["add", 0.6, 1.1], remove: ["remove", 0.6, 0.5], danger: ["remove", 0.6, 0.5], checkOff: ["remove", 0.45, 0.4],
    notify: ["notify", 0.6, 1.2], ok: ["notify", 0.5, 1.2], error: ["error", 0.55, 0.9],
    success: ["success", 0.7, 2.2], check: ["success", 0.7, 2.2], confetti: ["confetti", 0.6, 1.8],
  };
  const base = (() => { try { return new URL("sounds/", document.currentScript.src).href; } catch { return "sounds/"; } })();
  const buffers = {};
  let loading = false;
  function loadSamples() {
    if (loading) return;
    loading = true;
    const c = ac(); if (!c) return;
    [...new Set(Object.values(SAMPLES).map((x) => x[0]))].forEach((f) => {
      fetch(base + f + ".mp3").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((ab) => new Promise((ok, no) => c.decodeAudioData(ab, ok, no)))
        .then((buf) => {
          // Boshidagi jimlikni o'tkazib yuboramiz va balandlikni tenglashtiramiz (har xil fayllar bir xil eshitilsin)
          const d = buf.getChannelData(0);
          let peak = 0; for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; }
          let st = 0; while (st < d.length && Math.abs(d[st]) < peak * 0.05) st++;
          buffers[f] = { buf, off: Math.max(0, st / buf.sampleRate - 0.005), norm: peak > 0.01 ? Math.min(4, 0.9 / peak) : 1 };
        }).catch(() => {});
    });
  }
  function sample(name) {
    const sm = SAMPLES[name], b = sm && buffers[sm[0]];
    if (!b) return false;
    const c = ac(), src = c.createBufferSource(), g = c.createGain(), t = c.currentTime;
    src.buffer = b.buf;
    const len = b.buf.duration - b.off, dur = Math.min(len, sm[2]), v = sm[1] * b.norm;
    g.gain.setValueAtTime(v, t);
    if (len > sm[2]) { g.gain.setValueAtTime(v, t + dur - 0.12); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    src.connect(g).connect(bus || master);
    src.start(t, b.off); src.stop(t + dur + 0.02);
    return true;
  }
  // Fayllarni birinchi teginishda yuklaymiz (brauzer ovozni faqat shundan keyin ruxsat beradi)
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => addEventListener(ev, () => { if (on) loadSamples(); }, { once: true, capture: true, passive: true }));

  // Bir xil ovoz ketma-ket juda tez chalinmasin
  const last = {}, history = [];
  let total = 0, hushUntil = 0;
  function play(name, opts) {
    const s = SOUNDS[name];
    if (!s || document.hidden) return;
    const now = performance.now();
    const main = name === "check" || name === "success";
    if (!main && name !== "confetti" && now < hushUntil) return; // galochka jaranglayotganda boshqa ovozlar chalinmaydi
    if (main) hushUntil = now + (name === "check" ? 1300 : 900);
    if (now - (last[name] || 0) < (name === "hover" || name === "tick" ? 60 : 35)) return;
    last[name] = now;
    history.push(name); total++; if (history.length > 20) history.shift();
    if (on) {
      try {
        const c = ac();
        if (c) {
          if (["check", "success"].includes(name)) silenceOthers(); // galochka/g'alaba ovozi boshqa ovozlar bilan aralashmasin
          bus = c.createGain(); bus.connect(master); voices.add(bus);
          const mine = bus; setTimeout(() => voices.delete(mine), 1600);
        }
        if (!sample(name)) s[0]();
      } catch {} finally { bus = null; }
    }
    if (haptic && s[1] && !(opts && opts.noHaptic) && navigator.vibrate && matchMedia("(pointer: coarse)").matches) { try { navigator.vibrate(s[1]); } catch {} }
  }
  // Slayder: qiymatga qarab balandligi o'zgaradigan "tik"
  function slide(frac) {
    if (!on || document.hidden) return;
    const now = performance.now();
    if (now - (last.slide || 0) < 45) return;
    last.slide = now;
    try { tone(500 + 1500 * Math.max(0, Math.min(1, frac)), 0, 0.03, "triangle", 0.06); } catch {}
  }

  // ---------- Avtomatik ovoz: qaysi element qaysi ovozni oladi ----------
  const skips = [];
  const RULES = [
    ["#nextStep, [data-sfx-next]", "next"],
    ["#prevStep, [data-sfx-back]", "back"],
    [".ad-danger, .confirm, [data-cancel], [data-rv-del], #deleteBtn, #nDelete", "danger"],
    ["[data-close], .close, .modal-close", "close"],
    ["[role=tab], [data-auth-tab], .tabs button, .news-tabs button, #newsTabs button", "tab"],
    [".chip, [data-cat], [data-tag], [data-filter], [data-sort], .cat, [data-m], [data-v], [data-star]", "chip"],
    ["#nav a, .nav a, .ad-nav button, .ad-tabbar button, .ad-sheet button, .ad-sheet a, .footer a, [data-view], [data-goto]", "nav"],
    ["button[type=submit], form button:not([type=button]), .btn-primary", "submit"],
    [".icon-btn, .burger, .to-top, .cmp, .pw-eye, .ad-eye", "icon"],
    ["a[href]", "link"],
    ["button, .btn, [role=button], label.btn, summary", "click"],
  ];
  function soundFor(el) {
    const own = el.closest("[data-sfx]");
    if (own) return own.dataset.sfx === "none" ? null : own.dataset.sfx;
    if (skips.some((s) => el.closest(s))) return null;
    for (const [sel, name] of RULES) { const m = el.closest(sel); if (m) return name; }
    return null;
  }
  const CLICKABLE = "button, a[href], .btn, .chip, .cat, [role=button], [role=tab], label.btn, summary, [data-cat], [data-tag], [data-open], [data-star]";
  document.addEventListener("click", (e) => {
    const el = e.target.closest(CLICKABLE);
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    const name = soundFor(el);
    if (name) play(name);
  }, true);
  // Tanlovlar: ro'yxat (select), belgi (checkbox), variant (radio), slayder (range)
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.closest("[data-sfx=none]")) return;
    if (t.matches("select")) play("select");
    else if (t.matches("input[type=checkbox]")) play(t.checked ? "checkOn" : "checkOff");
    else if (t.matches("input[type=radio]")) play("select");
    else if (t.matches("input[type=file]") && t.files && t.files.length) play("notify");
  }, true);
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.matches("input[type=range]")) slide((t.value - (t.min || 0)) / ((t.max || 100) - (t.min || 0)));
  }, true);
  // Klaviatura bilan tugma bosilsa (Enter/Space) ham click hodisasi keladi — alohida ishlov kerak emas

  // ---------- Sozlamalar ----------
  function apply() {
    document.documentElement.classList.toggle("sound-off", !on);
    if (master) master.gain.value = vol;
  }
  function setOn(v) { on = v; ls.set("opus_sound", v ? "1" : "0"); apply(); if (v) { ac(); loadSamples(); play("toggle"); } }
  function setVolume(v) { vol = Math.max(0, Math.min(1, v)); ls.set("opus_sound_vol", String(vol)); if (master) master.gain.value = vol; }
  function setHaptic(v) { haptic = v; ls.set("opus_haptic", v ? "1" : "0"); if (v && navigator.vibrate) navigator.vibrate(20); }
  apply();
  window.SFX = {
    play, slide,
    skip: (sel) => skips.push(sel),
    toggle: () => setOn(!on), setOn, setVolume, setHaptic,
    get on() { return on; }, get volume() { return vol; }, get haptic() { return haptic; },
    get canVibrate() { return !!navigator.vibrate; },
    get loaded() { return Object.keys(buffers); }, // yozib olingan ovozlardan qaysilari yuklangan
    get history() { return history.slice(); }, get total() { return total; }, // tekshirish uchun: oxirgi chalingan ovozlar
  };
})();
