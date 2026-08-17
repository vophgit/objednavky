// Nạp các feed nhà cung cấp đã commit trong repo vào products.json:
//   canis, pht (MAGG), richter, den braven, luma
// Chạy tự động bởi GitHub Actions, hoặc tay: node scripts/update-supplier-feeds.mjs
//
// GIÁ: giá trong feed là giá MUA. Giá bán = giá mua × (1 + marže) theo từng hãng.
// Các mức marže dưới đây suy ra từ việc đối chiếu EAN trùng giữa feed nhà cung cấp
// và feed bán hàng của voph.cz (CPHArticleFeed) — tức là đúng mức voph.cz đang bán.
// Mặt hàng ĐÃ CÓ GIÁ trong products.json thì giữ nguyên, feed không ghi đè.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);

// Mỗi hãng: các tên file có thể có, trường tồn kho, hệ số giá bán / giá mua.
const SUPPLIERS = [
  { src: 'canis',     files: ['canis-feed.xml', 'canis feed.xml'],         stock: 'COUNT',       markup: 1.31 },
  { src: 'pht',       files: ['pht-feed.xml', 'pht feed.xml'],             stock: 'STOCKAMOUNT', markup: 1.37, price: 'YOURPRICE_VAT' },
  { src: 'richter',   files: ['richter-feed.xml', 'richter feed.xml'],     stock: 'STOCK',       markup: 1.10 },
  { src: 'denbraven', files: ['denbraven-feed.xml', 'denbraven feed.xml'], stock: null,          markup: 1.24 },
  // luma không có EAN nào trùng với feed voph.cz nên không suy ra được marže thực tế;
  // dùng tạm mức 1.35 (gần pht). Sửa số này nếu biết mức đúng.
  { src: 'luma',      files: ['luma-feed.xml', 'luma feed.xml'],           stock: 'AMOUNT',      markup: 1.35 },
];

const dec = (s) => (s == null ? '' : s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#13;/g, ' ').trim());
const tag = (b, n) => {
  const m = b.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>'));
  return m ? dec(m[1]) : '';
};
const num = (s) => {
  const v = parseFloat(String(s).replace(/\s| /g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : null;
};

// Bộ dịch CZ -> VI dùng chung với web
const w = {};
new Function('window', readFileSync(new URL('translate-vi.js', ROOT), 'utf8'))(w);
const viTranslate = w.viTranslate || (() => '');

// Nhóm hàng + số ks/balení đã chốt sẵn (theo EAN)
const readJson = (name) => {
  try { return JSON.parse(readFileSync(new URL(name, ROOT), 'utf8')); } catch (e) { return null; }
};
const groups = readJson('groups.json') || {};
const packs = readJson('packs.json') || {};
const gItems = groups.items || {};
const pItems = packs.items || {};

let oldProducts = readJson('products.json') || [];
const oldPrice = {};
for (const p of oldProducts) if (p.ean && p.price > 0) oldPrice[String(p.ean)] = p.price;

const added = [];
const report = [];

for (const s of SUPPLIERS) {
  const file = s.files.map((f) => new URL(encodeURI(f), ROOT)).find((u) => existsSync(u));
  if (!file) { report.push(`${s.src}: BỎ QUA — chưa commit file (${s.files.join(' / ')})`); continue; }
  const xml = readFileSync(file, 'utf8');
  const blocks = xml.match(/<SHOPITEM(?:\s[^>]*)?>[\s\S]*?<\/SHOPITEM>/g) || [];
  let skipStock = 0, skipEan = 0, keptPrice = 0, skipFree = 0;
  const out = [];
  for (const b of blocks) {
    const ean = tag(b, 'EAN').replace(/\D/g, '');
    if (!ean) { skipEan++; continue; }
    if (s.stock) {
      const n = num(tag(b, s.stock)) || 0;
      if (n <= 0) { skipStock++; continue; }
    }
    const name = tag(b, 'PRODUCTNAME') || tag(b, 'PRODUCT');
    if (!name) { skipEan++; continue; }

    const vatPct = num(tag(b, 'DPH')) || 21;
    const vat = 1 + vatPct / 100;
    const buyVat = num(tag(b, s.price || 'PRICE_VAT'));
    const buyNet = num(tag(b, s.price ? 'YOURPRICE' : 'PRICE'));
    const purchaseNet = buyNet != null ? buyNet : (buyVat != null ? buyVat / vat : null);
    if (purchaseNet == null) { skipEan++; continue; }

    let price = Math.round(purchaseNet * s.markup * 100) / 100;
    if (oldPrice[ean] != null) { price = oldPrice[ean]; keptPrice++; }
    // giá 0 = vật phẩm quảng cáo (plakát, stojan…), không phải hàng bán
    if (!(price > 0)) { skipFree++; continue; }

    const g = gItems[ean];
    const pk = pItems[ean];
    const stockN = s.stock ? (num(tag(b, s.stock)) || 0) : 0;
    out.push({
      code: tag(b, 'CODE') || tag(b, 'Kod') || tag(b, 'PRODUCT_SKU') || tag(b, 'ITEM_ID') || '',
      ean,
      name,
      group: g ? g[0] : 'Ostatní',
      price,
      stock: stockN,
      pack: pk ? pk[0] : (parseInt(tag(b, 'PACKAGE'), 10) || 1),
      unit: pk ? pk[1] : (tag(b, 'UNIT') || 'ks'),
      dph: vatPct === 21 ? 'ZS' : 'SS',
      img: tag(b, 'IMGURL'),
      nameVi: viTranslate(name),
      src: s.src,
    });
  }
  if (!out.length) { report.push(`${s.src}: 0 mặt hàng — BỎ QUA (file lỗi?)`); continue; }
  added.push(...out);
  report.push(`${s.src.padEnd(10)} ${String(out.length).padStart(6)} mặt hàng`
    + (skipStock ? `  (bỏ ${skipStock} hết hàng)` : '')
    + (keptPrice ? `  (giữ ${keptPrice} giá đặt tay)` : '')
    + (skipFree ? `  (bỏ ${skipFree} mục giá 0)` : ''));
}

if (!added.length) {
  console.log('Không có feed nhà cung cấp nào để nạp — giữ nguyên products.json.');
  process.exit(0);
}

// Bỏ hàng cũ của chính 5 hãng này (sẽ thay bằng bản mới), giữ nguyên nguồn khác.
const mine = new Set(SUPPLIERS.map((s) => s.src));
const keptOther = oldProducts.filter((p) => !mine.has(p.src));
// EAN trùng: nguồn có sẵn (voph / levior / dfpartner) thắng, rồi đến thứ tự SUPPLIERS ở trên.
const seen = new Set(keptOther.map((p) => String(p.ean)));
const fresh = [];
let dup = 0;
for (const p of added) {
  if (seen.has(p.ean)) { dup++; continue; }
  seen.add(p.ean);
  fresh.push(p);
}
const merged = keptOther.concat(fresh);
if (dup) report.push(`bỏ ${dup} mặt hàng trùng EAN với nguồn đã có`);

writeFileSync(new URL('products.json', ROOT), JSON.stringify(merged));
console.log(report.join('\n'));
console.log(`products.json: ${oldProducts.length} -> ${merged.length} mặt hàng`);
