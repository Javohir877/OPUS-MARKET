// OPUS MARKET — o'zgarmas ma'lumotlar: rasm yordamchilari, to'lov logotiplari, ikonkalar.
// (data.js — admin panel tahrirlaydigan ma'lumotlar: sozlamalar, kategoriyalar, mahsulotlar.)
//
// Rasmlar:
//  • "wm:..."  — Wikimedia Commons'dagi aynan shu modelning fotosi (erkin litsenziya, muallif sahifasiga havola mahsulot oynasida).
//               Fayl img/ papkasida saqlangan (nomidagi maxsus belgilar "_" ga almashtirilgan).
//  • "img/..." — o'zingizning rasmingiz (loyiha ichidagi img/ papkasiga qo'ying), masalan img: "img/hp-victus.jpg"
//  • "http..." — istalgan to'liq rasm manzili
const IMG = (id) => {
  if (id.startsWith("wm:")) return "img/" + id.slice(id.lastIndexOf("/") + 1).replace(/[^A-Za-z0-9._-]/g, "_");
  return id;
};
// Rasm muallifi sahifasi (Wikimedia Commons)
const CREDIT = (id) => id && id.startsWith("wm:") ? "https://commons.wikimedia.org/wiki/File:" + encodeURIComponent(id.slice(id.lastIndexOf("/") + 1)) : null;

const HERO_IMG = "img/hero.jpg"; // Unsplash foto

// To'lov tizimlari (logotiplar SVG ko'rinishida)
const PAYMENTS = [
  { id: "click", name: "Click", note: "Onlayn to'lov", svg: `<svg viewBox="0 0 120 40"><circle cx="20" cy="20" r="15" fill="#00A3FF"/><circle cx="20" cy="20" r="6.5" fill="none" stroke="#fff" stroke-width="3.5"/><text x="42" y="28" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="22" fill="#00A3FF">click</text></svg>` },
  { id: "payme", name: "Payme", note: "Onlayn to'lov", svg: `<svg viewBox="0 0 120 40"><text x="8" y="29" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="25" fill="#1d2b3a">pay</text><text x="53" y="29" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="25" fill="#33CCCC">me</text></svg>` },
  { id: "uzcard", name: "Uzcard", note: "Karta orqali", svg: `<svg viewBox="0 0 120 40"><rect x="4" y="8" width="24" height="24" rx="5" fill="#0d4c9c"/><path d="M10 14v7a6 6 0 0012 0v-7" fill="none" stroke="#3fb549" stroke-width="3.2" stroke-linecap="round"/><text x="34" y="27" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="17" fill="#0d4c9c">UZCARD</text></svg>` },
  { id: "humo", name: "Humo", note: "Karta orqali", svg: `<svg viewBox="0 0 120 40"><circle cx="18" cy="20" r="13" fill="#f7941d"/><circle cx="18" cy="20" r="6" fill="#fff"/><text x="38" y="28" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="22" fill="#1b3a6b">HUMO</text></svg>` },
  { id: "visa", name: "Visa", note: "Xalqaro karta", svg: `<svg viewBox="0 0 120 40"><text x="60" y="30" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-style="italic" font-weight="900" font-size="28" fill="#1A1F71">VISA</text></svg>` },
  { id: "mastercard", name: "Mastercard", note: "Xalqaro karta", svg: `<svg viewBox="0 0 120 40"><circle cx="48" cy="20" r="14" fill="#EB001B"/><circle cx="72" cy="20" r="14" fill="#F79E1B"/><path d="M60 9.2a14 14 0 010 21.6 14 14 0 010-21.6z" fill="#FF5F00"/></svg>` },
  { id: "uzum", name: "Uzum Nasiya", note: "Bo'lib to'lash 0%", svg: `<svg viewBox="0 0 120 40"><rect x="4" y="6" width="28" height="28" rx="8" fill="#7000FF"/><path d="M11 15v6a7 7 0 0014 0v-6" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/><text x="38" y="27" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="20" fill="#7000FF">uzum</text></svg>` },
  { id: "cash", name: "Naqd pul", note: "Qabul qilganda", svg: `<svg viewBox="0 0 120 40"><rect x="22" y="9" width="46" height="24" rx="4" fill="#16a34a"/><circle cx="45" cy="21" r="6" fill="none" stroke="#fff" stroke-width="2.5"/><text x="74" y="27" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="16" fill="#16a34a">so'm</text></svg>` },
];

const ICONS = {
  laptop: '<path d="M4 5a2 2 0 012-2h12a2 2 0 012 2v10H4V5zm2 0v8h12V5H6zM1 17h22v1a2 2 0 01-2 2H3a2 2 0 01-2-2v-1z"/>',
  pc: '<path d="M14 2h6a1 1 0 011 1v18a1 1 0 01-1 1h-6a1 1 0 01-1-1V3a1 1 0 011-1zm1 3v2h4V5h-4zm2 11a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM2 4h9v11H2zM4 17h5v2h1v2H3v-2h1z"/>',
  monitor: '<path d="M3 3h18a1 1 0 011 1v12a1 1 0 01-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 01-1-1V4a1 1 0 011-1zm1 2v10h16V5H4z"/>',
  keyboard: '<path d="M2 6h20a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V7a1 1 0 011-1zm2 3v2h2V9H4zm4 0v2h2V9H8zm4 0v2h2V9h-2zm4 0v2h2V9h-2zm-12 4v2h2v-2H4zm4 0v2h8v-2H8zm10 0v2h2v-2h-2zm0-4v2h2V9h-2z"/>',
  mouse: '<path d="M12 2a7 7 0 017 7v6a7 7 0 01-14 0V9a7 7 0 017-7zm-1 2.1A5 5 0 007 9v1h4V4.1zm2 0V10h4V9a5 5 0 00-4-4.9z"/>',
  audio: '<path d="M12 3a9 9 0 019 9v6a3 3 0 01-3 3h-2v-8h3v-1a7 7 0 00-14 0v1h3v8H6a3 3 0 01-3-3v-6a9 9 0 019-9z"/>',
  gpu: '<path d="M2 6h19a1 1 0 011 1v9a1 1 0 01-1 1h-6v2H5v-2H3v2H2V6zm5 3a3 3 0 100 6 3 3 0 000-6zm7 0a3 3 0 100 6 3 3 0 000-6z"/>',
  ssd: '<path d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2zm1 3v8h3V8H5zm5 0v2h9V8h-9zm0 4v2h6v-2h-6z"/>',
  gamepad: '<path d="M7 6h10a5 5 0 014.9 6l-1 5a3 3 0 01-5.2 1.3L14 16h-4l-1.7 2.3A3 3 0 013.1 17l-1-5A5 5 0 017 6zm0 3v2H5v2h2v2h2v-2h2v-2H9V9H7zm9.5 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-2 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>',
};
