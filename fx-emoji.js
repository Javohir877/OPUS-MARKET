// OPUS MARKET — emojilar o'rniga 3D rasm-ikonkalar (Microsoft Fluent Emoji 3D, MIT litsenziya).
// Sahifadagi matnda uchragan emoji avtomatik <img class="fx"> ga almashtiriladi: telefon/brauzerdan qat'i nazar bir xil, chiroyli ko'rinadi.
// Ko'p ishlatiladiganlari loyiha ichida (icons/fx/), qolganlari (masalan, AI javoblaridagi) — CDN dan; topilmasa emojining o'zi qoladi.
(() => {
  const LOCAL = new Set(["1f0cf","1f195","1f306","1f313","1f319","1f324","1f381","1f389","1f39f","1f3a7","1f3a8","1f3ac","1f3ae","1f3c6","1f3ec","1f3f7","1f41e","1f440","1f441","1f446","1f448","1f44b","1f464","1f494","1f49c","1f4a1","1f4ac","1f4b0","1f4b3","1f4b8","1f4bb","1f4be","1f4c2","1f4c5","1f4c9","1f4cb","1f4cc","1f4cd","1f4de","1f4e1","1f4e6","1f4e8","1f4f0","1f4f1","1f4f2","1f4f3","1f4f7","1f501","1f50a","1f50c","1f50d","1f510","1f512","1f514","1f515","1f517","1f520","1f525","1f532","1f558","1f5a5","1f5bc","1f5c2","1f5d1","1f648","1f64f","1f680","1f69a","1f6aa","1f6cd","1f6d2","1f6e0","1f6e1","1f9e0","1f9e9","1f9ea","1f9f0","1f9f9","1f9fe","1faaa","2139","21a9","23f0","23f1","23f3","23f9","2600","2696","26a0","26a1","26d4","2705","2708","270d","270f","2728","2744","274c","2753","2764","2b50"]);
  const CDN = "https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/";
  const me = document.currentScript && document.currentScript.src;
  const BASE = me ? new URL("icons/fx/", me).href : "icons/fx/";
  // Matn belgisi sifatida ishlatiladiganlar (strelka, ✓, © ...) — o'zgarmaydi
  const SKIP = new Set(["a9", "ae", "2122", "21aa", "2714", "2716", "2197", "2b06", "2b07", "25b6", "2665", "3030", "2194", "2195", "2196", "2198", "2199", "25c0", "2611", "2b05", "27a1"]);
  const RE = /(?:\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}️?)*|[\u{1F1E6}-\u{1F1FF}]{2})/gu;
  const TEST = /[℀-⯿\u{1F000}-\u{1FAFF}]/u;
  const NO = "SCRIPT,STYLE,TEXTAREA,INPUT,OPTION,SELECT,TITLE,CODE,PRE,NOSCRIPT,svg";
  const key = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((h) => h !== "fe0f").join("-");
  const fallback = (img) => img.replaceWith(document.createTextNode(img.alt));

  function make(e) {
    const k = key(e);
    if (SKIP.has(k)) return null;
    const img = document.createElement("img");
    img.className = "fx"; img.alt = e; img.draggable = false; img.decoding = "async";
    img.src = (LOCAL.has(k) ? BASE : CDN) + k + ".webp";
    img.onerror = () => fallback(img);
    return img;
  }
  function skip(node) {
    const p = node.parentElement;
    if (!p || p.closest(NO) || p.closest("[contenteditable],.no-fx")) return true;
    // Kabinet menyusidagi chiziqli ikonkalar (app.js MI) o'z holicha qoladi
    if (p.classList.contains("ri") && !p.classList.contains("ic") && window.__miHas && window.__miHas(node.data.trim())) return true;
    return false;
  }
  function fixText(node) {
    const t = node.data;
    if (!t || !TEST.test(t) || skip(node)) return;
    RE.lastIndex = 0;
    let m, last = 0, frag = null;
    while ((m = RE.exec(t))) {
      const img = make(m[0]);
      if (!img) continue;
      frag = frag || document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      frag.appendChild(img);
      last = m.index + m[0].length;
    }
    if (!frag) return;
    if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    node.replaceWith(frag);
  }
  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) return fixText(root);
    if (root.nodeType !== 1 || root.closest && root.closest(NO)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (TEST.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const L = [];
    while (w.nextNode()) L.push(w.currentNode);
    L.forEach(fixText);
  }
  window.fxScan = scan;
  let q = new Set(), sched = false;
  const flush = () => { sched = false; const L = [...q]; q.clear(); L.forEach((n) => n.isConnected && scan(n)); };
  const mo = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === "characterData") q.add(m.target);
      else m.addedNodes.forEach((n) => q.add(n));
    }
    if (!sched && q.size) { sched = true; queueMicrotask(flush); }
  });
  const start = () => { scan(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
