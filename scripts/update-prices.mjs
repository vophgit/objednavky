// GIÁ BÁN NETTO — cập nhật hằng ngày 4:15 giờ Séc theo feed voph.cz.
//   node scripts/update-prices.mjs
// Mặt hàng KHÔNG có trong feed  ->  GIỮ NGUYÊN giá cũ (không đặt về 0, không xoá).
// Không đụng tới tồn kho, nhóm hàng, ảnh, pack.
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
const FEED = 'https://voph.cz/pictures/feeds/CPHArticleFeed.xml';

const get = async (url) => {
  const r = await fetch(url, { headers: { 'user-agent': 'voph-feed-bot' } });
  if (!r.ok) throw new Error(url + ' -> HTTP ' + r.status);
  return r.text();
};
const cd = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
const _rx = {};
const tag = (b, n) => {
  const r = _rx[n] || (_rx[n] = new RegExp('<' + n + '>([\\s\\S]*?)</' + n + '>'));
  const m = b.match(r);
  return m ? cd(m[1]) : '';
};

const xml = await get(FEED);
const items = xml.match(/<SHOPITEM>[\s\S]*?<\/SHOPITEM>/g) || [];
if (items.length < 100) throw new Error('Feed chỉ có ' + items.length + ' mặt hàng — nghi lỗi, không cập nhật giá.');

// giá netto theo EAN
const price = {};
for (const s of items) {
  const ean = tag(s, 'EAN').replace(/\D/g, '');
  if (!ean) continue;
  const vat = parseFloat(tag(s, 'VAT')) || 21;
  const pv = parseFloat(tag(s, 'PRICE_VAT')) || 0;
  if (pv > 0) price[ean] = Math.round((pv / (1 + vat / 100)) * 100) / 100;
}

const file = new URL('products.json', ROOT);
const prods = JSON.parse(readFileSync(file, 'utf8'));
let changed = 0, kept = 0, same = 0;
for (const p of prods) {
  const np = price[String(p.ean)];
  if (np == null) { kept++; continue; }          // không có trong feed -> giữ nguyên
  if (np === p.price) { same++; continue; }
  p.price = np;
  changed++;
}
writeFileSync(file, JSON.stringify(prods));
console.log(`Feed voph: ${Object.keys(price).length} EAN có giá.`);
console.log(`products.json: ${prods.length} mặt hàng — đổi giá ${changed}, giữ nguyên vì không có trong feed ${kept}, giá không đổi ${same}.`);
