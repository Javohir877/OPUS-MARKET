# OPUS MARKET

Kompyuterlar va aksessuarlar onlayn do'koni (namuna-sayt): katalog, qidiruv, savat, promo-kodlar, bo'lib to'lash kalkulyatori, 3 bosqichli buyurtma va Three.js'dagi 3D noutbuk shou.

## Ishga tushirish

Hech qanday o'rnatish kerak emas — oddiy statik sayt.

- **Lokal:** `powershell -ExecutionPolicy Bypass -File serve.ps1` va brauzerda `http://localhost:8080` ni oching.
- **GitHub Pages:** repozitoriy → *Settings* → *Pages* → *Deploy from a branch* → `main` / `(root)`.

## Tuzilishi

| Fayl | Vazifasi |
|---|---|
| `index.html` | Sahifa tuzilishi |
| `styles.css` | Dizayn va animatsiyalar |
| `data.js` | Sozlamalar, kategoriyalar, mahsulotlar — **admin panel shu faylni tahrirlaydi** |
| `assets.js` | O'zgarmas qismlar: rasm yordamchilari, to'lov logotiplari, ikonkalar |
| `admin.html`, `admin.js`, `admin.css` | Admin panel: mahsulot/narx/ombor/rasm, yangiliklar, kategoriyalar, promo-kodlar, sozlamalar, buyurtmalar, ommaviy amallar, CSV, oldindan ko'rish, tarix; GitHub token orqali bitta commit bilan e'lon qiladi |
| `app.js` | Savat, filtrlar, qidiruv, buyurtma |
| `showcase.js` | 3D noutbuk shou (Three.js) |
| `scrollfx.js` | Scroll animatsiyalari: "elektr sxemasi", progress, parallaks, sarlavha effekti |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ilova (PWA): o'rnatish, ikonkalar, offline kesh |
| `make-icons.ps1` | Ilova ikonkalarini yasaydi |
| `publish-github.ps1` | Saytni GitHub'ga yuklaydi (faqat o'zgargan fayllarni) |
| `img/` | Mahsulot rasmlari |
| `build-artifact.ps1` | Claude Artifact uchun `deploy/index.html` yasaydi |

## Yangi versiyani joylashda

Kod fayllari (JS/CSS) o'zgarsa: `index.html` va `admin.html` dagi `?v=N` belgilarini hamda `sw.js` dagi `VERSION` ni bittaga oshiring. Admin panel faqat `data.js` ni o'zgartiradi va `sw.js` versiyasini o'zi oshiradi.

Android ilova (APK) — GitHub Releases'da (`v1.0`). Yangi APK chiqsa, yangi release yarating va admin paneldagi Sozlamalar → APK havolasini yangilang.

## Cheklovlar

- To'lov va buyurtmalar namuna: pul yechilmaydi, buyurtmalar faqat mijoz brauzerida (localStorage) saqlanadi.
- Narxlar va xususiyatlar taxminiy.

## Rasmlar mualliflari

- Mahsulot fotosuratlari — [Wikimedia Commons](https://commons.wikimedia.org) mualliflari, CC litsenziyalari asosida. Har bir rasmning muallif sahifasi saytdagi mahsulot oynasida ko'rsatilgan.
- Bezak rasmlari (`img/hero.jpg`, `img/deals.jpg`) — [Unsplash](https://unsplash.com).
