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

const [feedXml, availXml] = await Promise.all([get(FEED), get(AVAIL).catch(() => '')]);
const stock = {};
for (const m of availXml.matchAll(/<item id="([^"]+)">\s*<stock_quantity>(\d+)/g)) stock[m[1]] = +m[2];

const items = feedXml.match(/<SHOPITEM>[\s\S]*?<\/SHOPITEM>/g) || [];
const prods = items.map((s) => {
  const parts = tag(s, 'CATEGORYTEXT').split('|').map((x) => x.trim()).filter(Boolean);
  const vat = parseFloat(tag(s, 'VAT')) || 21;
  const pv = parseFloat(tag(s, 'PRICE_VAT')) || 0;
  const code = tag(s, 'ITEM_ID');
  const name = tag(s, 'PRODUCTNAME') || tag(s, 'PRODUCT');
  return {
    code, ean: tag(s, 'EAN'), name,
    group: parts[parts.length - 1] || 'Ostatní',
    cat: parts.join(' | '),
    price: Math.round((pv / (1 + vat / 100)) * 100) / 100,
    stock: stock[code] || 0, pack: 1, dph: 'ZS',
    img: (s.match(/<IMGURL>([\s\S]*?)<\/IMGURL>/) || [])[1] || '',
    nameVi: viTranslate(name),
  };
}).filter((p) => p.ean && p.name);

if (prods.length < 10) throw new Error('Feed chỉ có ' + prods.length + ' sản phẩm — không ghi đè products.json (có thể feed lỗi).');
writeFileSync(new URL('../products.json', import.meta.url), JSON.stringify(prods));
console.log('OK — ' + prods.length + ' sản phẩm, ' + Object.keys(stock).length + ' mục tồn kho.');
