// ================= OPUS MARKET — 3D Showcase (Three.js) =================
// Sahifa aylantirilganda noutbuk ochiladi, ekran yonadi va kamera yaqinlashadi.
(() => {
  const section = document.getElementById("showcase");
  const canvas = document.getElementById("showcaseCanvas");
  if (!section || !canvas) return;

  const fallback = () => section.classList.add("no-webgl");
  if (!window.THREE) return fallback();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return fallback();
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  // ---------- Muhit yoritilishi (metall aks ettirishlari uchun) ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x040203);
  const panel = (color, k, pos, size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide })
    );
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    envScene.add(m);
  };
  panel(0xffffff, 2.2, [0, 6, 0], [7, 7]);
  panel(0xff1a30, 4, [-6, 1.5, 2], [3, 7]);
  panel(0xff5a2e, 2.5, [6, 1, -2], [3, 7]);
  panel(0xffffff, 1.2, [0, 1.5, 7], [9, 2]);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;

  // ---------- Yordamchi: yumaloq burchakli plita ----------
  function slab(w, d, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 4, curveSegments: 14 });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // ---------- Materiallar ----------
  const aluminium = new THREE.MeshStandardMaterial({ color: 0x0d0a0b, metalness: 0.92, roughness: 0.3, envMapIntensity: 0.75 });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x070506, metalness: 0.5, roughness: 0.5, envMapIntensity: 0.4 });
  const keyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7, envMapIntensity: 0.25 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0x241b1d, metalness: 0.5, roughness: 0.25 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff1430, toneMapped: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff1a35, toneMapped: false });

  // ---------- Noutbuk ----------
  const laptop = new THREE.Group();
  scene.add(laptop);

  const W = 3.2, D = 2.2, BH = 0.12;
  const base = new THREE.Mesh(slab(W, D, BH, 0.14), aluminium);
  laptop.add(base);

  // Klaviatura ostidagi qizil nur (tugmalar orasidan ko'rinadi)
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 1.1), deckMat);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, BH + 0.02, -0.42);
  laptop.add(deck);
  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.04), glowMat.clone());
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.set(0, BH + 0.021, -0.42);
  laptop.add(underGlow);

  // Tugmalar (InstancedMesh)
  const COLS = 15, ROWS = 6;
  const keyW = 0.165, gap = 0.024;
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(keyW, 0.025, keyW), keyMat, COLS * ROWS);
  const keyPos = [];
  const m4 = new THREE.Matrix4();
  let k = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let x = -((COLS - 1) * (keyW + gap)) / 2 + c * (keyW + gap);
      let sx = 1;
      if (r === ROWS - 1) { // probel qatori
        if (c >= 5 && c <= 9) { if (c !== 7) { m4.makeScale(0.0001, 0.0001, 0.0001); keys.setMatrixAt(k, m4); keyPos.push([0, 0]); k++; continue; } sx = 5.4; }
      }
      const z = -0.92 + r * (keyW + gap) + 0.04;
      m4.makeScale(sx, 1, 1).setPosition(x, BH + 0.032, z);
      keys.setMatrixAt(k, m4);
      keyPos.push([x, z]);
      k++;
    }
  }
  laptop.add(keys);
  const keyColor = new THREE.Color();
  const keyDark = new THREE.Color(0x141012);
  const keyRed = new THREE.Color(0xff2038);
  for (let i = 0; i < COLS * ROWS; i++) keys.setColorAt(i, keyDark);

  // Sensorli panel
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, BH + 0.021, 0.62);
  laptop.add(pad);

  // Old tomondagi nur chizig'i
  const frontStrip = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.012, 0.01), glowMat.clone());
  frontStrip.position.set(0, BH / 2, D / 2 + 0.02);
  laptop.add(frontStrip);

  // Sharnir
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 24), aluminium);
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BH + 0.03, -D / 2 + 0.02);
  laptop.add(hinge);

  // Qopqoq (sharnir atrofida aylanadi)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, BH + 0.07, -D / 2 + 0.02);
  laptop.add(lidPivot);
  const lidGeo = slab(W, D - 0.04, 0.06, 0.14);
  lidGeo.translate(0, 0, (D - 0.04) / 2);
  const lid = new THREE.Mesh(lidGeo, aluminium);
  lidPivot.add(lid);

  // Qopqoq orqasidagi yonib turuvchi OPUS logotipi
  const logo = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 20, 64), ringMat.clone());
  logo.rotation.x = Math.PI / 2;
  logo.position.set(0, 0.082, (D - 0.04) / 2);
  lidPivot.add(logo);
  const logoHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex("rgba(255,30,50,1)"), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  logoHalo.scale.set(1.3, 1.3, 1);
  logoHalo.position.set(0, 0.1, (D - 0.04) / 2);
  lidPivot.add(logoHalo);

  // ---------- Ekran (jonli canvas tekstura) ----------
  const sc = document.createElement("canvas");
  sc.width = 1024; sc.height = 640;
  const ctx = sc.getContext("2d");
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.encoding = THREE.sRGBEncoding;
  screenTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: 0x000000 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.96, 1.9), screenMat);
  screen.rotation.x = Math.PI / 2; // pastga qaragan (yopiq holatda)
  screen.position.set(0, -0.022, (D - 0.04) / 2 + 0.03);
  lidPivot.add(screen);

  // Ekran nuri klaviaturaga tushadi
  const screenLight = new THREE.PointLight(0xff6070, 0, 4, 2);
  screenLight.position.set(0, 0.9, 0.2);
  laptop.add(screenLight);

  // Mahsulot rasmlari ekran uchun
  const shots = (typeof PRODUCTS !== "undefined" ? [1, 17, 21].map((id) => PRODUCTS.find((p) => p.id === id)).filter(Boolean) : []).map((p) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.src = IMG(p.img, 500);
    return { p, im };
  });

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function cover(im, x, y, w, h) {
    const s = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    const sw = w / s, sh = h / s;
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }
  const fmtS = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";

  function drawScreen(t) {
    const Wc = sc.width, Hc = sc.height;
    const bg = ctx.createLinearGradient(0, 0, Wc, Hc);
    bg.addColorStop(0, "#14070a"); bg.addColorStop(1, "#22090e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, Wc, Hc);

    // Yuqori panel
    ctx.fillStyle = "#0b0405"; ctx.fillRect(0, 0, Wc, 64);
    ctx.fillStyle = "#e10f2a"; rr(24, 14, 36, 36, 9); ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(42, 32, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.font = "800 24px Arial"; ctx.fillStyle = "#fff"; ctx.fillText("OPUS", 72, 41);
    ctx.fillStyle = "#ff2a40"; ctx.fillText("MARKET", 142, 41);
    ctx.font = "500 17px Arial"; ctx.fillStyle = "#b8a5aa";
    ["Noutbuklar", "Kompyuterlar", "Aksiya"].forEach((s, i) => ctx.fillText(s, 430 + i * 130, 39));
    ctx.fillStyle = "#e10f2a"; rr(Wc - 130, 16, 106, 32, 16); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "700 16px Arial"; ctx.fillText("🛒 Savat 3", Wc - 117, 38);

    // Banner
    const bx = 28, by = 84, bw = Wc - 56, bh = 196;
    const bgr = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    bgr.addColorStop(0, "#ff4d2e"); bgr.addColorStop(0.5, "#e10f2a"); bgr.addColorStop(1, "#6e0413");
    ctx.fillStyle = bgr; rr(bx, by, bw, bh, 22); ctx.fill();
    // Banner yaltirashi
    const sh = ((t * 0.25) % 1.6) - 0.3;
    const sg = ctx.createLinearGradient(bx + bw * sh - 120, 0, bx + bw * sh + 120, 0);
    sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,.22)"); sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.save(); rr(bx, by, bw, bh, 22); ctx.clip(); ctx.fillStyle = sg; ctx.fillRect(bx, by, bw, bh); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "800 50px Arial"; ctx.fillText("MEGA CHEGIRMA", 60, 160);
    ctx.font = "600 26px Arial"; ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillText("40% gacha · OPUS10 promo-kod", 60, 200);
    const pulse = 1 + Math.sin(t * 4) * 0.04;
    ctx.save(); ctx.translate(160, 240); ctx.scale(pulse, pulse);
    ctx.fillStyle = "#fff"; rr(-100, -22, 200, 44, 22); ctx.fill();
    ctx.fillStyle = "#c00a22"; ctx.font = "800 19px Arial"; ctx.textAlign = "center"; ctx.fillText("Xarid qilish →", 0, 7);
    ctx.restore(); ctx.textAlign = "left";
    // Ekvalayzer
    for (let i = 0; i < 14; i++) {
      const h = 30 + (Math.sin(t * 3 + i * 0.7) * 0.5 + 0.5) * 110;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.15})`;
      rr(640 + i * 24, by + bh - 24 - h, 14, h, 6); ctx.fill();
    }

    // Mahsulot kartochkalari
    const cw = (Wc - 56 - 40) / 3, cy = 304, ch = 312;
    const active = Math.floor(t / 1.8) % 3;
    shots.forEach(({ p, im }, i) => {
      const cx = 28 + i * (cw + 20);
      const lift = i === active ? -8 : 0;
      ctx.save(); ctx.translate(0, lift);
      if (i === active) { ctx.shadowColor = "rgba(255,30,50,.8)"; ctx.shadowBlur = 30; }
      ctx.fillStyle = "#241115"; rr(cx, cy, cw, ch, 18); ctx.fill();
      ctx.shadowBlur = 0;
      if (i === active) { ctx.strokeStyle = "#ff2a40"; ctx.lineWidth = 3; rr(cx, cy, cw, ch, 18); ctx.stroke(); }
      ctx.save(); rr(cx, cy, cw, 180, 18); ctx.clip();
      if (im.complete && im.naturalWidth) cover(im, cx, cy, cw, 180);
      else { ctx.fillStyle = "#3a1a20"; ctx.fillRect(cx, cy, cw, 180); }
      ctx.restore();
      if (p.old) {
        ctx.fillStyle = "#e10f2a"; rr(cx + 12, cy + 12, 64, 28, 8); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "700 15px Arial"; ctx.fillText("−" + Math.round((1 - p.price / p.old) * 100) + "%", cx + 22, cy + 32);
      }
      ctx.fillStyle = "#fff"; ctx.font = "700 20px Arial"; ctx.fillText(p.name.length > 22 ? p.name.slice(0, 21) + "…" : p.name, cx + 16, cy + 214);
      ctx.fillStyle = "#ffb020"; ctx.font = "16px Arial"; ctx.fillText("★★★★★  " + p.rating, cx + 16, cy + 240);
      ctx.fillStyle = "#ff3b52"; ctx.font = "800 22px Arial"; ctx.fillText(fmtS(p.price), cx + 16, cy + 280);
      ctx.fillStyle = "#e10f2a"; ctx.beginPath(); ctx.arc(cx + cw - 34, cy + 272, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "700 26px Arial"; ctx.textAlign = "center"; ctx.fillText("+", cx + cw - 34, cy + 281); ctx.textAlign = "left";
      ctx.restore();
    });

    // Kursor
    const curX = 28 + active * (cw + 20) + cw - 30 + Math.sin(t * 2) * 6;
    const curY = cy + 280 + Math.cos(t * 2) * 4;
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(curX, curY); ctx.lineTo(curX, curY + 26); ctx.lineTo(curX + 7, curY + 20); ctx.lineTo(curX + 18, curY + 20); ctx.closePath(); ctx.fill(); ctx.stroke();

    // Skanerlash chizig'i
    const scanY = (t * 120) % Hc;
    const scan = ctx.createLinearGradient(0, scanY - 40, 0, scanY);
    scan.addColorStop(0, "rgba(255,40,60,0)"); scan.addColorStop(1, "rgba(255,40,60,.08)");
    ctx.fillStyle = scan; ctx.fillRect(0, scanY - 40, Wc, 40);
    screenTex.needsUpdate = true;
  }

  // ---------- Pol nuri va soya ----------
  function radialTex(color, inner = 0) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(128, 128, inner, 128, 128, 128);
    gr.addColorStop(0, color);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  const floorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9),
    new THREE.MeshBasicMaterial({ map: radialTex("rgba(255,20,45,.55)"), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.y = -0.02;
  laptop.add(floorGlow);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.4),
    new THREE.MeshBasicMaterial({ map: radialTex("rgba(0,0,0,.85)", 30), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.015;
  laptop.add(shadow);

  // ---------- Orbita halqalari ----------
  const rings = new THREE.Group();
  scene.add(rings);
  [[3.1, 0.012, 0.55, 0.35], [3.7, 0.008, 0.35, -0.5], [4.4, 0.006, 0.22, 0.2]].forEach(([r, tube, op, tilt]) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, tube, 8, 180),
      new THREE.MeshBasicMaterial({ color: 0xff2a40, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    m.rotation.x = Math.PI / 2 + tilt;
    m.userData.speed = 0.08 + Math.random() * 0.1;
    m.rotation.z = Math.random() * Math.PI * 2;
    // Halqa ustidagi yorqin nuqta
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffd0d5, toneMapped: false }));
    dot.position.x = r;
    m.add(dot);
    rings.add(m);
  });

  // ---------- Zarrachalar ----------
  const PCOUNT = innerWidth < 700 ? 260 : 520;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(PCOUNT * 3);
  const pCol = new Float32Array(PCOUNT * 3);
  const pal = [new THREE.Color(0xff1a35), new THREE.Color(0xff6a3d), new THREE.Color(0xffc2c8)];
  for (let i = 0; i < PCOUNT; i++) {
    const rad = 2.5 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    pPos[i * 3] = Math.cos(th) * rad;
    pPos[i * 3 + 1] = (Math.random() - 0.3) * 6;
    pPos[i * 3 + 2] = Math.sin(th) * rad;
    const c = pal[(Math.random() * pal.length) | 0];
    pCol.set([c.r, c.g, c.b], i * 3);
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.06, map: radialTex("rgba(255,255,255,1)"), vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
  }));
  scene.add(particles);

  // ---------- Chiroqlar ----------
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2, 6, 5);
  scene.add(key);
  const rimRed = new THREE.PointLight(0xff1a35, 3, 12, 2);
  rimRed.position.set(-3.5, 1.8, -1.5);
  scene.add(rimRed);
  const rimOrange = new THREE.PointLight(0xff5a2e, 2, 12, 2);
  rimOrange.position.set(3.5, 1.2, -2);
  scene.add(rimOrange);

  laptop.position.y = -0.55;

  // ---------- Holat ----------
  const ui = {
    steps: [...section.querySelectorAll(".sc-step")],
    bar: document.getElementById("scBar"),
    chips: [...section.querySelectorAll(".sc-chip")],
    hint: section.querySelector(".sc-hint"),
  };
  const cur = { lid: 0, power: 0, rotY: -0.9, camZ: 9, camY: 3.4, offX: -1.25, mx: 0, my: 0 };
  const mouse = { x: 0, y: 0 };
  let progress = 0;
  let visible = false;
  let activeStep = -1;

  section.addEventListener("pointermove", (e) => {
    const r = section.getBoundingClientRect();
    mouse.x = (e.clientX / r.width) * 2 - 1;
    mouse.y = (e.clientY / innerHeight) * 2 - 1;
  });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);

  function readScroll() {
    const r = section.getBoundingClientRect();
    progress = clamp(-r.top / (r.height - innerHeight));
  }
  addEventListener("scroll", readScroll, { passive: true });

  new IntersectionObserver((en) => {
    visible = en[0].isIntersecting;
    if (visible) { resize(); readScroll(); }
  }, { rootMargin: "200px" }).observe(section);

  function updateUI(p) {
    const step = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
    if (step !== activeStep) {
      activeStep = step;
      ui.steps.forEach((s, i) => s.classList.toggle("active", i === step));
    }
    ui.bar.style.transform = `scaleY(${p})`;
    ui.chips.forEach((c, i) => c.classList.toggle("show", p > 0.7 + i * 0.04));
    ui.hint.classList.toggle("hide", p > 0.05);
  }

  // ---------- Animatsiya sikli ----------
  const clock = new THREE.Clock();
  let frame = 0;
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const p = progress;
    const ease = reduceMotion ? 1 : 0.075;
    const mobile = camera.aspect < 1;

    // Maqsad qiymatlar (scroll bo'yicha)
    const tLid = smooth(0.08, 0.5, p) * 1.92;
    const tPower = smooth(0.42, 0.58, p);
    const tRotY = lerp(-0.95, 0, smooth(0, 0.55, p)) + smooth(0.7, 1, p) * 0.45;
    const dist = mobile ? 2.1 / Math.max(camera.aspect, 0.42) * 0.42 + 0.35 : 1;
    const tCamZ = lerp(9.5, 7.4, smooth(0, 0.5, p)) - smooth(0.6, 1, p) * 0.9;
    const tCamY = lerp(3.6, 1.9, smooth(0, 0.5, p)) - smooth(0.6, 1, p) * 0.3;
    // Keng ekranda noutbuk matndan o'ngda turadi
    const tOffX = mobile ? 0 : -(1.25 + smooth(0.6, 1, p) * 0.35);

    cur.lid = lerp(cur.lid, tLid, ease);
    cur.power = lerp(cur.power, tPower, ease);
    cur.rotY = lerp(cur.rotY, tRotY, ease);
    cur.camZ = lerp(cur.camZ, tCamZ * dist, ease);
    cur.camY = lerp(cur.camY, tCamY, ease);
    cur.offX = lerp(cur.offX, tOffX, ease);
    cur.mx = lerp(cur.mx, mouse.x, 0.05);
    cur.my = lerp(cur.my, mouse.y, 0.05);

    // Noutbuk
    lidPivot.rotation.x = -cur.lid;
    laptop.rotation.y = cur.rotY + cur.mx * 0.25 + (reduceMotion ? 0 : Math.sin(t * 0.4) * 0.05);
    laptop.rotation.x = cur.my * 0.06;
    laptop.position.y = -0.55 + (reduceMotion ? 0 : Math.sin(t * 1.2) * 0.06);

    // Ekran va yorug'lik
    const pw = cur.power;
    const flicker = pw > 0.02 && pw < 0.6 ? (Math.random() > 0.85 ? 0.6 : 1) : 1;
    screenMat.color.setScalar(pw * flicker);
    screenLight.intensity = pw * 1.6;
    if (pw > 0.01 && frame % 2 === 0) drawScreen(t);

    // Klaviatura "to'lqin" yoritgichi
    const kb = 0.25 + pw * 0.75;
    for (let i = 0; i < keyPos.length; i++) {
      const [x, z] = keyPos[i];
      const wave = Math.sin(t * 3 - x * 2.2 - z * 1.5) * 0.5 + 0.5;
      keyColor.copy(keyDark).lerp(keyRed, wave * 0.55 * kb);
      keys.setColorAt(i, keyColor);
    }
    keys.instanceColor.needsUpdate = true;
    underGlow.material.color.setRGB(1, 0.08, 0.18).multiplyScalar(0.35 + pw * 0.9 + Math.sin(t * 2) * 0.08);
    frontStrip.material.color.setRGB(1, 0.1, 0.2).multiplyScalar(0.5 + Math.sin(t * 3) * 0.4);
    logo.material.color.setRGB(1, 0.1, 0.2).multiplyScalar(1.2 + Math.sin(t * 2) * 0.4);
    logoHalo.material.opacity = 0.5 + Math.sin(t * 2) * 0.25;

    // Halqalar va zarrachalar
    rings.children.forEach((r, i) => { r.rotation.z += r.userData.speed * dt * (i % 2 ? -1 : 1) * 4; });
    rings.rotation.y = t * 0.05;
    rings.position.y = laptop.position.y + 0.4;
    particles.rotation.y = t * 0.03;
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) {
      arr[i * 3 + 1] += dt * (0.08 + (i % 7) * 0.02);
      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -2.5;
    }
    pGeo.attributes.position.needsUpdate = true;

    // Kamera
    camera.position.set(cur.offX + cur.mx * 0.6, cur.camY - cur.my * 0.3, cur.camZ);
    camera.lookAt(cur.offX, 0.25 + smooth(0.5, 1, p) * 0.3 - (mobile ? 0.9 : 0), 0);

    updateUI(p);
    renderer.render(scene, camera);
    frame++;
  }

  resize();
  readScroll();
  tick();
})();
