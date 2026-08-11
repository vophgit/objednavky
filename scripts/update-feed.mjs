// Tải feed voph.cz → products.json. Chạy tự động bởi GitHub Actions (2:30 sáng) hoặc tay: node scripts/update-feed.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const FEED = 'https://voph.cz/pictures/feeds/CPHArticleFeed.xml';
const AVAIL = 'https://voph.cz/pictures/feeds/CPHArticleAvailabilityFeed.xml';

// Nạp bộ dịch tiếng Việt (dùng chung file với web)
const w = {};
new Function('window', readFileSync(new URL('../translate-vi.js', import.meta.url), 'utf8'))(w);
const viTranslate = w.viTranslate || (() => '');

const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'voph-feed-bot' } });
  if (!r.ok) throw new Error(url + ' → HTTP ' + r.status);
  return r.text();
};
const tag = (s, n) => {
  const m = s.match(new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim() : '';
};

// Sản phẩm voph.cz không có cột nhóm hàng của Levior — xếp vào đúng 1 trong các nhóm gốc
// của Levior (cột K file "levior all") bằng cách tham khảo từ khóa trong tên, không tự đặt nhóm mới.
const norm = (s) => s.toLowerCase()
  .replace(/[áàâã]/g, 'a').replace(/[éèêě]/g, 'e').replace(/[íìî]/g, 'i').replace(/[óòôõ]/g, 'o')
  .replace(/[úùûů]/g, 'u').replace(/[ýÿ]/g, 'y').replace(/č/g, 'c').replace(/ď/g, 'd').replace(/ň/g, 'n')
  .replace(/ř/g, 'r').replace(/š/g, 's').replace(/ť/g, 't').replace(/ž/g, 'z');
const GROUP_KEYWORDS = [
  ['AKU NÁŘADÍ', [/\baku\b.{0,15}(vrtac|sroubov|pila|bruska|sekack|naradi|kladivo)/, /(vrtac|sroubov|pila|bruska|sekack|naradi|kladivo).{0,15}\baku\b/]],
  ['Automotive', [/\bauto(diln|doplnk|baterie|zarovk)/, /zvedak/, /\bpneu\b/, /prevodovk/, /motorov(y|eho) olej/, /naviják|navijak/]],
  ['Měřidla a značkovače', [/svinovac.{0,3}metr|\bpasmo\b/, /posuvn.{0,3}meridlo|mikrometr/, /vodovah/, /uhelnik|uhlomer/, /\blaser|dalkomer/, /znackovac|popisovac|rysovac/]],
  ['ELEKTRICKÉ NÁŘADÍ, SVĚTLA, KABELY', [/vrtac(ka|ky)|bruska|okruzn.{0,3}pila|svarec|pajk|vysav|tavn.{0,3}pistol|kompresor|tlakov.{0,3}cistic|cerpadl|svitiln|reflektor|\bled\b.{0,3}(svetl|zarovk)|topidl|prodluzovac.{0,3}kabel|kabelov.{0,3}buben/]],
  ['Zahradní nářadí', [/zahradn|sekack|zavlazovac|postrikovac|macet|kerov.{0,3}nuzky|sit.{0,3}proti hmyzu/]],
  ['Železářské zboží', [/visaci zamek|\bzamek\b|trezor|schranka na klic|karabin|retez|napinaci.{0,3}drat|vazaci.{0,3}drat|zavitov.{0,3}tyc/]],
  ['Stavební nářadí', [/zednick|hladitk|leseni|zebrik|schudk|dlazb|oblkad|malirsk|sadrokarton|pu pen|vytlacovac.{0,3}pistol/]],
  ['Nástroje', [/vrtak|freza|pilnik|brusny kotouc|pilovy kotouc|rezacka.{0,3}trub|zavitnik/]],
  ['Dílenské nářadí', [/kleste|sroubovak|kladivo|palice|sverak|sponkovac/]],
];
function classifyGroup(name) {
  const n = norm(name);
  for (const [group, patterns] of GROUP_KEYWORDS) if (patterns.some((re) => re.test(n))) return group;
  return 'ostatni';
}

const [feedXml, availXml] = await Promise.all([get(FEED), get(AVAIL).catch(() => '')]);
// Prodejní ceny se z feedu NEberou — zachováme stávající ceny z products.json (import ceny dělá admin přes prices.json).
let oldPrices = {};
let oldProducts = [];
try { oldProducts = JSON.parse(readFileSync(new URL('../products.json', import.meta.url), 'utf8')); for (const p of oldProducts) oldPrices[p.ean] = p.price; } catch (e) {}
const stock = {};
for (const m of availXml.matchAll(/<item id="([^"]+)">\s*<stock_quantity>(\d+)/g)) stock[m[1]] = +m[2];

const items = feedXml.match(/<SHOPITEM>[\s\S]*?<\/SHOPITEM>/g) || [];
const prods = items.map((s) => {
  const parts = tag(s, 'CATEGORYTEXT').split('|').map((x) => x.trim()).filter(Boolean);
  const vat = parseFloat(tag(s, 'VAT')) || 21;
  const pv = parseFloat(tag(s, 'PRICE_VAT')) || 0;
  const code = tag(s, 'ITEM_ID');
  const name = tag(s, 'PRODUCTNAME') || tag(s, 'PRODUCT');
  const ean = tag(s, 'EAN');
  return {
    code, ean, name,
    group: classifyGroup(name),
    cat: parts.join(' | '),
    price: oldPrices[ean] != null ? oldPrices[ean] : Math.round((pv / (1 + vat / 100)) * 100) / 100,
    stock: stock[code] || 0, pack: 1, dph: 'ZS',
    img: (s.match(/<IMGURL>([\s\S]*?)<\/IMGURL>/) || [])[1] || '',
    nameVi: viTranslate(name),
    src: 'voph',
  };
}).filter((p) => p.ean && p.name);

if (prods.length < 10) throw new Error('Feed chỉ có ' + prods.length + ' sản phẩm — không ghi đè products.json (có thể feed lỗi).');
// Giữ nguyên các mặt hàng đến từ nguồn khác (vd. Levior) — chỉ thay thế phần voph.cz.
const kept = oldProducts.filter((p) => p.src && p.src !== 'voph');
// Dispozice của TẤT CẢ hãng (Levior, df partner, ...) chỉ đọc theo EAN trùng từ feed voph.cz — không dùng tồn kho riêng của hãng đó.
const eanStock = {};
for (const p of prods) eanStock[p.ean] = p.stock;
const keptAdj = kept.filter((p) => !prods.some((np) => np.ean === p.ean)).map((p) => {
  if (eanStock[p.ean] != null) return Object.assign({}, p, { stock: eanStock[p.ean] });
  return p;
});
const merged = prods.concat(keptAdj);
writeFileSync(new URL('../products.json', import.meta.url), JSON.stringify(merged));
console.log('OK — ' + prods.length + ' sản phẩm voph.cz (+ ' + (merged.length - prods.length) + ' giữ nguyên từ nguồn khác), ' + Object.keys(stock).length + ' mục tồn kho.');
