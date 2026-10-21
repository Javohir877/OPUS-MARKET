// OPUS MARKET — mahsulotlar bazasi
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

const CATEGORIES = [
  { id: "laptop", name: "Noutbuklar", icon: "laptop", img: "wm:9/93/HP_Victus_laptop_2.jpg" },
  { id: "pc", name: "Kompyuterlar", icon: "pc", img: "wm:b/bd/2025_Wnętrze_komputera_PC.jpg" },
  { id: "monitor", name: "Monitorlar", icon: "monitor", img: "wm:e/e8/BenQ_SW2700PT-42_(30482110015).jpg" },
  { id: "keyboard", name: "Klaviaturalar", icon: "keyboard", img: "wm:6/63/Razer_Blackwidow_Chroma_1_2017-01-01.jpg" },
  { id: "mouse", name: "Sichqonchalar", icon: "mouse", img: "wm:5/5b/Razer_Basilisk_V3_1.jpg" },
  { id: "audio", name: "Quloqchinlar", icon: "audio", img: "wm:c/c4/JBL_LIVE_650_BTNC_(Over-Ear_Noise_Cancelling_Headphone)._(51127342181).jpg" },
  { id: "parts", name: "Komplektlar", icon: "gpu", img: "wm:5/5a/Palit_GeForce_RTX_5090_Gamerock_20250530_HOF4166_RAW-Export.png" },
  { id: "storage", name: "Xotira / Disk", icon: "ssd", img: "wm:4/46/SAMSUNG_M.2_NVMe_SSD_990_PRO_4TB.jpg" },
  { id: "gaming", name: "O'yin uchun", icon: "gamepad", img: "wm:c/cb/Xbox_Series_Controller_Carbon_Black.jpg" },
];

const PRODUCTS = [
  // ---------- Noutbuklar ----------
  { id: 1, cat: "laptop", brand: "ASUS", name: "ASUS ROG Strix G16", price: 24900000, old: 28500000, rating: 4.9, reviews: 214, stock: 7, popular: 98, badge: "Xit",
    img: "wm:d/d1/ROG_Strix_G16_2026-08-08_ASUS_01.jpg", gallery: ["wm:f/f1/ROG_Strix_G16_2026-08-08_ASUS_02.jpg"],
    desc: "O'yinlar va professional ish uchun kuchli noutbuk. Yuqori chastotali displey va ilg'or sovutish tizimi.",
    specs: { Protsessor: "Intel Core i9-14900HX", Videokarta: "RTX 4070 8GB", "Operativ xotira": "32GB DDR5", Xotira: "1TB NVMe SSD", Displey: '16" QHD+ 240Hz' } },
  { id: 2, cat: "laptop", brand: "Apple", name: 'MacBook Pro 14" M5', price: 24500000, old: null, rating: 5.0, reviews: 389, stock: 12, popular: 100, badge: "Yangi",
    img: "wm:d/d7/MacBook_Pro_(14-inch,_M5,_Space_Black).jpg",
    desc: "Apple M5 chipi, Liquid Retina XDR displey va kun bo'yi ishlaydigan batareya. Rang: Space Black.",
    specs: { Protsessor: "Apple M5 10-yadro", Videokarta: "10-yadroli GPU", "Operativ xotira": "16GB", Xotira: "512GB SSD", Displey: '14.2" Liquid Retina XDR' } },
  { id: 3, cat: "laptop", brand: "Lenovo", name: "Lenovo ThinkPad X1 Carbon Gen 7", price: 8900000, old: 10500000, rating: 4.7, reviews: 122, stock: 5, popular: 80,
    img: "wm:e/e9/ThinkPad_X1_Carbon_gen7_(0).jpg",
    desc: "Biznes uchun yengil va mustahkam ultrabuk — afsonaviy ThinkPad klaviaturasi va 1.1 kg vazn.",
    specs: { Protsessor: "Intel Core i7-8665U", "Operativ xotira": "16GB LPDDR3", Xotira: "512GB SSD", Displey: '14" FHD IPS', "Og'irlik": "1.09 kg" } },
  { id: 4, cat: "laptop", brand: "HP", name: "HP Victus 15", price: 10900000, old: 12500000, rating: 4.5, reviews: 301, stock: 20, popular: 92,
    img: "wm:9/93/HP_Victus_laptop_2.jpg", gallery: ["wm:b/b2/HP_Victus_laptop.jpg"],
    desc: "Talabalar va boshlang'ich geymerlar uchun eng yaxshi narx/sifat nisbati.",
    specs: { Protsessor: "AMD Ryzen 5 8645HS", Videokarta: "RTX 4050 6GB", "Operativ xotira": "16GB DDR5", Xotira: "512GB SSD", Displey: '15.6" FHD 144Hz' } },
  { id: 5, cat: "laptop", brand: "Lenovo", name: "Lenovo Legion Y7000P", price: 15400000, old: 17200000, rating: 4.7, reviews: 143, stock: 9, popular: 84,
    img: "wm:7/7d/Lenovo_Legion_Y7000P_Eclipse_Gray_Laptop.jpg",
    desc: "Legion seriyasining mashhur o'yin noutbuki — kuchli sovutish va yorqin displey. Rang: Eclipse Gray.",
    specs: { Protsessor: "Intel Core i7-13650HX", Videokarta: "RTX 4060 8GB", "Operativ xotira": "16GB DDR5", Xotira: "1TB SSD", Displey: '16" 2.5K 165Hz' } },

  // ---------- Kompyuterlar ----------
  { id: 6, cat: "pc", brand: "OPUS", name: "OPUS Titan Gaming PC", price: 42000000, old: 46000000, rating: 4.9, reviews: 76, stock: 3, popular: 95, badge: "Xit",
    img: "wm:d/de/Ricer_gaming_PC_with_CPU_watercooler.jpg",
    desc: "OPUS ustaxonasida yig'iladigan flagman o'yin kompyuteri: suyuq sovutish va RGB yoritgich. 4K o'yinlar uchun tayyor.",
    specs: { Protsessor: "AMD Ryzen 9 9950X3D", Videokarta: "RTX 5090 32GB", "Operativ xotira": "64GB DDR5 6000", Xotira: "2TB NVMe Gen5", Sovutish: "360mm suyuq sovutish" } },
  { id: 7, cat: "pc", brand: "OPUS", name: "OPUS Aurora RGB Gaming PC", price: 19800000, old: 22500000, rating: 4.8, reviews: 58, stock: 6, popular: 86,
    img: "wm:b/bd/2025_Wnętrze_komputera_PC.jpg",
    desc: "Panoramali korpus, ko'plab ARGB ventilyatorlar va suyuq sovutish — OPUS ustaxonasida yig'ilgan o'yin kompyuteri.",
    specs: { Protsessor: "Intel Core i7-14700KF", Videokarta: "RTX 4070 Super 12GB", "Operativ xotira": "32GB DDR5", Xotira: "1TB NVMe SSD", Quvvat: "850W 80+ Gold" } },
  { id: 8, cat: "pc", brand: "Dell", name: "Dell OptiPlex 5060 Micro", price: 4900000, old: null, rating: 4.6, reviews: 158, stock: 25, popular: 70,
    img: "wm:b/bf/Dell_OptiPlex_5060_Micro.jpg",
    desc: "Ofis uchun ixcham va jim kompyuter — monitor ortiga ham o'rnatiladi.",
    specs: { Protsessor: "Intel Core i5-8500T", "Operativ xotira": "16GB DDR4", Xotira: "256GB SSD", Korpus: "Micro (1.2 litr)", Portlar: "USB-C, DP, HDMI" } },
  { id: 9, cat: "pc", brand: "Apple", name: 'Apple iMac 24" M4', price: 21500000, old: null, rating: 4.8, reviews: 91, stock: 6, popular: 77, badge: "Yangi",
    img: "wm:5/59/IMac_(M4,_2024,_Silver).jpg",
    desc: "Hammasi bitta korpusda: 4.5K Retina displey va kuchli M4 chip. Rang: Silver.",
    specs: { Protsessor: "Apple M4 10-yadro", "Operativ xotira": "16GB", Xotira: "512GB SSD", Displey: '24" 4.5K Retina', Kamera: "12MP Center Stage" } },

  // ---------- Monitorlar ----------
  { id: 10, cat: "monitor", brand: "ASUS", name: 'ASUS ROG Strix XG32VQR 32"', price: 6200000, old: 7400000, rating: 4.7, reviews: 190, stock: 10, popular: 88,
    img: "wm:0/0b/ASUS_ROG_Strix_XG32VQR_monitor.jpg",
    desc: "1800R egilgan geymer monitori: 144Hz, HDR400 va Aura Sync yoritgichi.",
    specs: { "O'lcham": '31.5"', Ruxsat: "2560×1440 QHD", Chastota: "144Hz", Matritsa: "VA, egilgan 1800R", HDR: "DisplayHDR 400" } },
  { id: 11, cat: "monitor", brand: "LG", name: 'LG UltraFine 5K 27"', price: 14500000, old: null, rating: 4.6, reviews: 97, stock: 4, popular: 74,
    img: "wm:4/4e/LG_UltraFine_5K_Display.jpg",
    desc: "Mac uchun yaratilgan 5K monitor — Thunderbolt 3 orqali tasvir, ovoz va quvvat bitta kabelda.",
    specs: { "O'lcham": '27"', Ruxsat: "5120×2880 5K", Matritsa: "IPS", "Rang qamrovi": "P3 99%", Portlar: "Thunderbolt 3, 3× USB-C" } },
  { id: 12, cat: "monitor", brand: "BenQ", name: 'BenQ SW2700PT 27"', price: 7300000, old: 8100000, rating: 4.7, reviews: 112, stock: 8, popular: 72,
    img: "wm:e/e8/BenQ_SW2700PT-42_(30482110015).jpg",
    desc: "Fotograflar uchun professional monitor: Adobe RGB 99% va apparat kalibrlash.",
    specs: { "O'lcham": '27"', Ruxsat: "2560×1440 QHD", Matritsa: "IPS", "Rang qamrovi": "Adobe RGB 99%", "Qo'shimcha": "Soyabon qalpoq" } },

  // ---------- Klaviaturalar ----------
  { id: 13, cat: "keyboard", brand: "Logitech", name: "Logitech G515 Lightspeed TKL", price: 1900000, old: 2200000, rating: 4.7, reviews: 233, stock: 15, popular: 85,
    img: "wm:1/16/Logitech_G515_Lightspeed_TKL_Wireless_Keyboard.jpg",
    desc: "Ultra-yupqa simsiz mexanik klaviatura — Lightspeed va Bluetooth ulanishi.",
    specs: { Turi: "Mexanik, TKL, past profil", Ulanish: "Lightspeed / Bluetooth / USB-C", Batareya: "36 soatgacha", Yoritish: "LIGHTSYNC RGB" } },
  { id: 14, cat: "keyboard", brand: "Razer", name: "Razer BlackWidow Chroma", price: 1600000, old: null, rating: 4.6, reviews: 145, stock: 11, popular: 72,
    img: "wm:6/63/Razer_Blackwidow_Chroma_1_2017-01-01.jpg",
    desc: "Makro tugmalar va Chroma RGB yoritgichli to'liq o'lchamli mexanik klaviatura.",
    specs: { Turi: "Mexanik, Full-size", Ulanish: "USB", Sviches: "Razer Green", "Qo'shimcha": "5 ta makro tugma", Yoritish: "Chroma RGB" } },
  { id: 15, cat: "keyboard", brand: "Keychron", name: "Keychron K8 Wireless", price: 1100000, old: 1300000, rating: 4.6, reviews: 98, stock: 18, popular: 66,
    img: "wm:f/fb/Keychron_K8_Non-Backlight_Wireless_Mechanical_Keyboard.jpg",
    desc: "Mac va Windows uchun simsiz TKL mexanik klaviatura.",
    specs: { Turi: "Mexanik, TKL", Ulanish: "Bluetooth 5.1 / USB-C", Sviches: "Gateron", Batareya: "4000 mAh", Moslik: "macOS / Windows" } },
  { id: 16, cat: "keyboard", brand: "Logitech", name: "Logitech G PRO TKL", price: 1450000, old: 1700000, rating: 4.7, reviews: 176, stock: 13, popular: 70,
    img: "wm:5/50/Logitech_G_PRO_TKL_gaming_keyboard_-_English_(United_States)_layout.jpg",
    desc: "Kibersport professionallari bilan birga ishlab chiqilgan ixcham klaviatura.",
    specs: { Turi: "Mexanik, TKL", Ulanish: "Ajraladigan USB kabel", Sviches: "GX Blue Clicky", Yoritish: "LIGHTSYNC RGB" } },

  // ---------- Sichqonchalar ----------
  { id: 17, cat: "mouse", brand: "Logitech", name: "Logitech G Pro X Superlight 2", price: 1890000, old: 2200000, rating: 4.9, reviews: 506, stock: 22, popular: 97, badge: "Xit",
    img: "wm:8/88/Logitech_Pro_X_Superlight_2_sample_20231216.jpg",
    desc: "Atigi 60 gramm — professional kibersportchilarning tanlovi. Rang: Magenta.",
    specs: { Sensor: "HERO 2, 32K DPI", "Og'irlik": "60 g", Ulanish: "Lightspeed", Batareya: "95 soat", Tugmalar: "5 ta" } },
  { id: 18, cat: "mouse", brand: "Razer", name: "Razer DeathAdder Elite", price: 650000, old: null, rating: 4.7, reviews: 288, stock: 35, popular: 82,
    img: "wm:0/01/Razer_DeathAdder_Elite-front_oblique-ar_16to10-fs_PNr°0465.jpg",
    desc: "Dunyodagi eng ko'p sotilgan geymer sichqonchalardan biri — ergonomik shakl.",
    specs: { Sensor: "5G optik, 16K DPI", Ulanish: "USB simli", Tugmalar: "7 ta", Shakl: "Ergonomik", Yoritish: "Chroma RGB" } },
  { id: 19, cat: "mouse", brand: "Logitech", name: "Logitech MX Master 3S", price: 1290000, old: 1450000, rating: 4.8, reviews: 371, stock: 14, popular: 86,
    img: "wm:9/90/Logitech_MX_Master_3S_HS01.jpg",
    desc: "Ish uchun eng qulay sichqoncha — jim tugmalar va MagSpeed g'ildirak.",
    specs: { Sensor: "8K DPI Darkfield", Ulanish: "Bluetooth / Bolt", Batareya: "70 kun", Qurilmalar: "3 tagacha", Zaryad: "USB-C" } },
  { id: 20, cat: "mouse", brand: "Razer", name: "Razer Basilisk V3", price: 890000, old: 1100000, rating: 4.6, reviews: 174, stock: 19, popular: 71,
    img: "wm:5/5b/Razer_Basilisk_V3_1.jpg",
    desc: "11 ta dasturlanadigan tugma va Chroma RGB yoritgichli geymer sichqoncha.",
    specs: { Sensor: "Focus+ 26K DPI", Tugmalar: "11 ta", "G'ildirak": "HyperScroll", Ulanish: "USB simli", Yoritish: "Chroma RGB" } },

  // ---------- Quloqchinlar ----------
  { id: 21, cat: "audio", brand: "Sony", name: "Sony WH-1000XM3", price: 2600000, old: 3100000, rating: 4.8, reviews: 342, stock: 9, popular: 90,
    img: "wm:4/4b/Sony-WH-1000XM3-kabellose-Bluetooth-Noise-Cancelling-Kopfhoerer.jpg",
    desc: "Afsonaviy shovqin bostiruvchi simsiz quloqchinlar — g'ilofi bilan.",
    specs: { Turi: "Yopiq, simsiz", ANC: "Ha, HD QN1", Batareya: "30 soat", Ulanish: "Bluetooth, LDAC", "Og'irlik": "255 g" } },
  { id: 22, cat: "audio", brand: "Apple", name: "AirPods Pro 3", price: 3200000, old: null, rating: 4.8, reviews: 455, stock: 27, popular: 93, badge: "Yangi",
    img: "wm:b/b9/AirPods_Pro_3_with_case.jpg",
    desc: "Faol shovqin bostirish va shaxsiy fazoviy audio — zaryadlash g'ilofi bilan.",
    specs: { Turi: "TWS", ANC: "Ha", Batareya: "8 soatgacha", Himoya: "IP57", Zaryad: "USB-C / MagSafe" } },
  { id: 23, cat: "audio", brand: "Apple", name: "AirPods Max", price: 6900000, old: 7600000, rating: 4.7, reviews: 129, stock: 5, popular: 79,
    img: "wm:8/8e/Apple_AirPods_Max.jpg",
    desc: "Premium dizayn, hisoblash audiosi va mukammal shovqin bostirish.",
    specs: { Turi: "Yopiq, simsiz", ANC: "Ha", Batareya: "20 soat", Chip: "Apple H1", "Og'irlik": "385 g" } },
  { id: 24, cat: "audio", brand: "JBL", name: "JBL Live 650BTNC", price: 1300000, old: 1550000, rating: 4.5, reviews: 263, stock: 28, popular: 68,
    img: "wm:c/c4/JBL_LIVE_650_BTNC_(Over-Ear_Noise_Cancelling_Headphone)._(51127342181).jpg",
    desc: "JBL Signature Sound va shovqin bostirish funksiyasiga ega arzon quloqchin.",
    specs: { Turi: "Yopiq, simsiz", ANC: "Ha", Batareya: "30 soat (ANC bilan 20)", Ulanish: "Bluetooth 4.2", Assistent: "Google / Alexa" } },

  // ---------- Komplektlar ----------
  { id: 25, cat: "parts", brand: "Palit", name: "Palit GeForce RTX 5090 GameRock 32GB", price: 36000000, old: 39500000, rating: 4.9, reviews: 88, stock: 3, popular: 91, badge: "Xit",
    img: "wm:5/5a/Palit_GeForce_RTX_5090_Gamerock_20250530_HOF4166_RAW-Export.png",
    desc: "Eng kuchli o'yin videokartasi: Blackwell arxitekturasi, DLSS 4 va 32GB GDDR7 xotira.",
    specs: { Xotira: "32GB GDDR7", Shina: "512-bit", Port: "3× DP 2.1, 1× HDMI 2.1", Quvvat: "575W", Arxitektura: "Blackwell" } },
  { id: 26, cat: "parts", brand: "Gigabyte", name: "Gigabyte RTX 4070 Aero OC 12GB", price: 8200000, old: 9300000, rating: 4.7, reviews: 117, stock: 11, popular: 84,
    img: "wm:f/fd/2023_Gigabyte_GeForce_RTX_4070_Aero_OC_12GB_(1).jpg",
    desc: "Oq rangli yig'ilishlar uchun chiroyli va tejamkor 1440p videokarta.",
    specs: { Xotira: "12GB GDDR6X", Shina: "192-bit", Port: "3× DP 1.4a, 1× HDMI 2.1", Quvvat: "200W", Rang: "Oq" } },
  { id: 27, cat: "parts", brand: "Intel", name: "Intel Core i9-14900KF", price: 6400000, old: null, rating: 4.8, reviews: 132, stock: 10, popular: 89,
    img: "wm:0/0a/Intel_i9-14900KF_CPU.jpg",
    desc: "24 yadroli flagman protsessor — o'yinlar va kontent yaratish uchun 6.0 GHz gacha.",
    specs: { Yadrolar: "24 yadro (8P + 16E) / 32 oqim", Chastota: "6.0 GHz gacha", Kesh: "36MB", Soket: "LGA 1700", TDP: "125W" } },
  { id: 28, cat: "parts", brand: "Corsair", name: "Corsair Vengeance RGB DDR5 32GB", price: 1450000, old: 1700000, rating: 4.7, reviews: 210, stock: 40, popular: 75,
    img: "wm:5/53/2023_Pamięci_Corsair_Vengeance_RGB.jpg",
    desc: "Oq rangli, RGB yoritgichli yuqori tezlikdagi DDR5 xotira to'plami (2×16GB).",
    specs: { Hajm: "32GB (2×16GB)", Turi: "DDR5", Chastota: "6000 MHz", Taymingi: "CL36", Rang: "Oq, RGB" } },

  // ---------- Xotira ----------
  { id: 29, cat: "storage", brand: "Samsung", name: "Samsung 990 PRO 4TB NVMe", price: 4300000, old: 4900000, rating: 4.9, reviews: 377, stock: 24, popular: 87,
    img: "wm:4/46/SAMSUNG_M.2_NVMe_SSD_990_PRO_4TB.jpg",
    desc: "7450 MB/s gacha o'qish tezligiga ega PCIe 4.0 NVMe SSD.",
    specs: { Hajm: "4TB", Interfeys: "PCIe 4.0 NVMe", "O'qish": "7450 MB/s", Yozish: "6900 MB/s", Kafolat: "5 yil" } },
  { id: 30, cat: "storage", brand: "Seagate", name: "Seagate BarraCuda 2TB", price: 850000, old: 990000, rating: 4.5, reviews: 318, stock: 45, popular: 69,
    img: "wm:e/ef/Seagate_BarraCuda_Compute_2TB_3.5-inch_SATA_HDD_-_top_view.jpg",
    desc: "Kundalik foydalanish va arxiv uchun ishonchli va arzon 3.5\" qattiq disk.",
    specs: { Hajm: "2TB", Interfeys: "SATA III", Tezlik: "7200 rpm", Kesh: "256MB", Kafolat: "2 yil" } },

  // ---------- O'yin uchun ----------
  { id: 31, cat: "gaming", brand: "Sony", name: "Sony DualSense Midnight Black", price: 950000, old: 1100000, rating: 4.8, reviews: 402, stock: 30, popular: 81,
    img: "wm:5/5b/Playstation_5_DualSense_controller_in_Midnight_Black,_2026-02-07_(front).jpg",
    desc: "Haptik qayta aloqa va adaptiv triggerlar — PS5 va PC uchun. Rang: Midnight Black.",
    specs: { Moslik: "PS5 / PC / Mac", Ulanish: "Bluetooth / USB-C", Batareya: "12 soatgacha", Funksiyalar: "Haptic, Adaptive Triggers", Mikrofon: "Ichki" } },
  { id: 32, cat: "gaming", brand: "Sony", name: "Sony DualSense Chroma Pearl", price: 1050000, old: null, rating: 4.8, reviews: 96, stock: 12, popular: 67, badge: "Yangi",
    img: "wm:e/e2/DualSense_Controller_Chroma_Pearl.jpg",
    desc: "DualSense'ning Chroma kolleksiyasidagi marvarid rangli nashri.",
    specs: { Moslik: "PS5 / PC / Mac", Ulanish: "Bluetooth / USB-C", Batareya: "12 soatgacha", Funksiyalar: "Haptic, Adaptive Triggers", Rang: "Chroma Pearl" } },
  { id: 33, cat: "gaming", brand: "Xbox", name: "Xbox Wireless Controller Carbon Black", price: 850000, old: null, rating: 4.7, reviews: 265, stock: 26, popular: 73,
    img: "wm:c/cb/Xbox_Series_Controller_Carbon_Black.jpg",
    desc: "Windows bilan to'liq mos, qulay va mustahkam o'yin pulti.",
    specs: { Moslik: "Xbox / PC / Mobil", Ulanish: "Bluetooth / Xbox Wireless", Batareya: "40 soat (AA)", Port: "USB-C", "Og'irlik": "287 g" } },
  { id: 34, cat: "gaming", brand: "Meta", name: "Meta Quest 3 512GB", price: 7400000, old: 8200000, rating: 4.8, reviews: 154, stock: 7, popular: 86, badge: "Xit",
    img: "wm:9/99/Meta_Quest_3_front_View.jpg",
    desc: "Aralash reallik (MR) va virtual reallik — kabelsiz, mustaqil VR shlem.",
    specs: { Xotira: "512GB", Displey: "2064×2208 har bir ko'zga", Chastota: "120Hz gacha", Protsessor: "Snapdragon XR2 Gen 2", Batareya: "2.2 soat" } },
];

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
