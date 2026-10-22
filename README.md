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
| `data.js` | Mahsulotlar, kategoriyalar, to'lov usullari — narx va mahsulotlarni shu yerda o'zgartiring |
| `app.js` | Savat, filtrlar, qidiruv, buyurtma |
| `showcase.js` | 3D noutbuk shou (Three.js) |
| `scrollfx.js` | Scroll animatsiyalari: "elektr sxemasi", progress, parallaks, sarlavha effekti |
| `manifest.webmanifest`, `sw.js`, `icons/` | Ilova (PWA): o'rnatish, ikonkalar, offline kesh |
| `make-icons.ps1` | Ilova ikonkalarini yasaydi |
| `publish-github.ps1` | Saytni GitHub'ga yuklaydi (faqat o'zgargan fayllarni) |
| `img/` | Mahsulot rasmlari |
| `build-artifact.ps1` | Claude Artifact uchun `deploy/index.html` yasaydi |

## Cheklovlar

- To'lov va buyurtmalar namuna: pul yechilmaydi, buyurtmalar faqat mijoz brauzerida (localStorage) saqlanadi.
- Narxlar va xususiyatlar taxminiy.

## Rasmlar mualliflari

- Mahsulot fotosuratlari — [Wikimedia Commons](https://commons.wikimedia.org) mualliflari, CC litsenziyalari asosida. Har bir rasmning muallif sahifasi saytdagi mahsulot oynasida ko'rsatilgan.
- Bezak rasmlari (`img/hero.jpg`, `img/deals.jpg`) — [Unsplash](https://unsplash.com).
