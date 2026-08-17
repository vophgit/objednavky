// TỒN KHO (dispozice) — cập nhật hằng ngày 4:25 giờ Séc theo feed voph.cz.
//   node scripts/update-stock.mjs
// Mặt hàng KHÔNG có trong feed  ->  tồn kho = 0 (web hiện "7-14 ngày").
// Không đụng tới giá, nhóm hàng, ảnh, pack.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const FEED = 'https://voph.cz/pictures/feeds/CPHArticleFeed.xml';
const AVAIL = 'https://voph.cz/pictures/feeds/CPHArticleAvailabilityFeed.xml';

const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'voph-feed-bot' } });
  if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
  return r.text();
};
const cd = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
const _rx = {};
const tag = (b, n) => {
  const r = _rx[n] || (_rx[n] = new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>'));
  const m = b.match(r);
  return m ? cd(m[1]) : '';
};

const [xml, availXml] = await Promise.all([get(FEED), get(AVAIL).catch(() => '')]);
const items = xml.match(/<SHOPITEM>[\s\S]*?<\/SHOPITEM>/g) || [];
if (items.length < 100) throw new Error('Feed chỉ có ' + items.length + ' mặt hàng — nghi lỗi, không cập nhật tồn kho.');

// tồn kho theo ITEM_ID rồi quy về EAN
const byItemId = {};
for (const m of availXml.matchAll(/<item id="([^"]+)">\s*<stock_quantity>(\d+)/g)) byItemId[m[1]] = +m[2];
const stock = {};
for (const s of items) {
  const ean = tag(s, 'EAN').replace(/\D/g, '');
  if (!ean) continue;
  stock[ean] = byItemId[tag(s, 'ITEM_ID')] || 0;
}

const file = new URL('products.json', ROOT);
const prods = JSON.parse(readFileSync(file, 'utf8'));
let up = 0, zero = 0;
for (const p of prods) {
  const s = stock[String(p.ean)];
  if (s == null) { if (p.stock !== 0) { p.stock = 0; zero++; } continue; }  // ngoài feed -> 0
  if (p.stock !== s) up++;
  p.stock = s;
}
writeFileSync(file, JSON.stringify(prods));
const inStock = prods.filter((p) => p.stock > 0).length;
console.log(`Feed voph: ${Object.keys(stock).length} EAN, ${Object.keys(byItemId).length} mục tồn kho.`);
console.log(`products.json: ${prods.length} mặt hàng — cập nhật ${up}, đặt về 0 vì ngoài feed ${zero}, hiện còn hàng ${inStock}.`);
