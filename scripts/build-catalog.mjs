// DỰNG LẠI TOÀN BỘ CATALOG từ "cenik b2bdmoc.xlsx" — CHỈ CHẠY TAY, KHÔNG nằm trong workflow đêm.
//   node scripts/build-catalog.mjs
//
// Nguồn chuẩn: cenik b2bdmoc.xlsx (export ERP)
//   A Zkratka 1 = mã voph   B Implicitní EAN   C Jaz.název   D Prodejní cena netto
//   E Opt. Dodavatel        F Zkratka 2 = mã nhà sản xuất    G Počet ks v bal
//
// Quy tắc:
//   - mã nhà sản xuất (F) nối vào CUỐI tên sản phẩm
//   - G = 0 hoặc 1  -> thử lấy từ feed nhà sản xuất, không có thì = 1 (bán lẻ từng cái)
//   - nhóm hàng: groups.json giữ nguyên; hàng chưa có thì đoán từ feed + tên
//   - ảnh: hàng cũ giữ nguyên; hàng mới lấy từ feed. GHI CỐ ĐỊNH, sau này không tự đổi.
//   - hàng đang bán mà cenik không có: GIỮ LẠI (theo yêu cầu)
// Tồn kho và giá do 2 script riêng cập nhật hằng ngày (update-stock / update-prices).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const ROOT = new URL('../', import.meta.url);
const CENIK = ['cenik b2bdmoc.xlsx', 'cenik-b2bdmoc.xlsx'];

// ---------------------------------------------------------------- đọc xlsx
function entries(buf) {
  const out = [];
  for (let p = buf.length - 22; p >= 0; p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      const cnt = buf.readUInt16LE(p + 10);
      let off = buf.readUInt32LE(p + 16);
      for (let k = 0; k < cnt; k++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) break;
        out.push({ method: buf.readUInt16LE(off + 10), csize: buf.readUInt32LE(off + 20),
                   lho: buf.readUInt32LE(off + 42),
                   name: buf.toString('utf8', off + 46, off + 46 + buf.readUInt16LE(off + 28)) });
        off += 46 + buf.readUInt16LE(off + 28) + buf.readUInt16LE(off + 30) + buf.readUInt16LE(off + 32);
      }
      break;
    }
  }
  return out;
}
function unzip(buf, e) {
  const start = e.lho + 30 + buf.readUInt16LE(e.lho + 26) + buf.readUInt16LE(e.lho + 28);
  const d = buf.subarray(start, start + e.csize);
  return e.method === 0 ? d.toString('utf8') : inflateRawSync(d).toString('utf8');
}
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
function sheetRows(buf) {
  const es = entries(buf);
  const shared = [];
  const ss = es.find((f) => f.name.includes('sharedStrings'));
  if (ss) for (const si of unzip(buf, ss).match(/<si>[\s\S]*?<\/si>/g) || [])
    shared.push((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
  const sh = es.find((f) => /worksheets\/sheet1\.xml$/.test(f.name)) || es.find((f) => /worksheets\//.test(f.name));
  if (!sh) throw new Error('xlsx không hợp lệ');
  return (unzip(buf, sh).match(/<row[^>]*>[\s\S]*?<\/row>/g) || []).map((row) => {
    const cells = {};
    for (const c of row.match(/<c [^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const t = (c.match(/t="([^"]+)"/) || [])[1];
      let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (t === 's') v = shared[+v];
      if (t === 'inlineStr') v = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      if (v != null) cells[ref] = unesc(String(v));
    }
    return cells;
  });
}

// ---------------------------------------------------------------- đọc feed
const cd = (s) => (s == null ? '' : unesc(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')).trim());
// cache regex: nếu biên dịch lại cho từng thẻ của từng mặt hàng thì 38k mặt hàng = hàng trăm nghìn lần
const _rxc = {};
const ftag = (b, n) => {
  const rx = _rxc[n] || (_rxc[n] = new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>'));
  const m = b.match(rx);
  return m ? cd(m[1]) : '';
};
const FEEDS = [
  { f: ['CPHArticleFeed.xml'],                       item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: '' },
  { f: ['levior-feed.xml'],                          item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: 'PACKAGE' },
  { f: ['canis-feed.xml', 'canis feed.xml'],         item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: '' },
  { f: ['pht-feed.xml', 'pht feed.xml'],             item: 'SHOPITEM', cat: 'CATH',         pack: '' },
  { f: ['richter-feed.xml', 'richter feed.xml'],     item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: '' },
  { f: ['denbraven-feed.xml', 'denbraven feed.xml'], item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: '' },
  { f: ['luma-feed.xml', 'luma feed.xml'],           item: 'SHOPITEM', cat: 'CATEGORYTEXT', pack: 'PACKAGE' },
];
const feedImg = {}, feedCat = {}, feedPack = {};
let feedFiles = 0;
for (const F of FEEDS) {
  const u = F.f.map((x) => new URL(encodeURI(x), ROOT)).find((x) => existsSync(x));
  if (!u) continue;
  feedFiles++;
  const txt = readFileSync(u, 'utf8');
  const itemRx = new RegExp('<' + F.item + '(?:\\s[^>]*)?>[\\s\\S]*?</' + F.item + '>', 'g');
  for (const b of txt.match(itemRx) || []) {
    const ean = ftag(b, 'EAN').replace(/\D/g, '');
    if (!ean) continue;
    const img = ftag(b, 'IMGURL');
    if (img && !feedImg[ean]) feedImg[ean] = img;
    const cat = ftag(b, F.cat);
    if (cat && !feedCat[ean]) feedCat[ean] = cat;
    if (F.pack) {
      const n = parseInt(ftag(b, F.pack), 10);
      if (n > 1 && !feedPack[ean]) feedPack[ean] = n;
    }
  }
}

// ---------------------------------------------------------------- dữ liệu sẵn có
const readJson = (n) => { try { return JSON.parse(readFileSync(new URL(n, ROOT), 'utf8')); } catch (e) { return null; } };
const groups = readJson('groups.json') || { items: {}, _order: [] };
const gItems = groups.items || {};
const oldProducts = readJson('products.json') || [];
const oldByEan = {};
for (const p of oldProducts) oldByEan[String(p.ean)] = p;

const w = {};
new Function('window', readFileSync(new URL('translate-vi.js', ROOT), 'utf8'))(w);
const viTranslate = w.viTranslate || ((s) => s);

// Nhóm hàng lấy từ groups.json (đã phân sẵn). EAN nào thiếu -> Ostatní, sửa tay qua admin.html.
const guessGroup = () => ['Ostatní', 'Nezařazeno'];

// ---------------------------------------------------------------- dựng catalog
const cenFile = CENIK.map((f) => new URL(encodeURI(f), ROOT)).find((u) => existsSync(u));
if (!cenFile) { console.error('KHÔNG thấy ' + CENIK[0] + ' — dừng, giữ nguyên products.json.'); process.exit(1); }
const rows = sheetRows(readFileSync(cenFile));

const out = [];
const stat = { skip: 0, packFeed: 0, packOne: 0, imgOld: 0, imgFeed: 0, imgNone: 0,
               grpOld: 0, grpGuess: 0, mfgAppended: 0 };
const seen = new Set();
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const ean = String(r.B || '').replace(/\.0+$/, '').trim();
  const name0 = String(r.C || '').trim();
  const price = Math.round(parseFloat(String(r.D || '0').replace(',', '.')) * 100) / 100;
  if (!/^\d{6,14}$/.test(ean) || !name0 || !(price > 0) || seen.has(ean)) { stat.skip++; continue; }
  seen.add(ean);

  const mfg = String(r.F || '').trim();
  const name = mfg && !name0.endsWith(mfg) ? name0 + ' ' + mfg : name0;
  if (mfg) stat.mfgAppended++;

  let pack = parseInt(String(r.G || '0'), 10) || 0;
  if (pack <= 1) {
    if (feedPack[ean]) { pack = feedPack[ean]; stat.packFeed++; }
    else { pack = 1; stat.packOne++; }
  }

  const prev = oldByEan[ean];
  let img = prev && prev.img ? prev.img : '';
  if (img) stat.imgOld++;
  else if (feedImg[ean]) { img = feedImg[ean]; stat.imgFeed++; }
  else stat.imgNone++;

  let g = gItems[ean];
  if (g && g[0]) stat.grpOld++;
  else { g = guessGroup(name0, feedCat[ean]); gItems[ean] = g; stat.grpGuess++; }

  out.push({
    code: String(r.A || '').trim(), ean, name,
    group: g[0], price,
    stock: prev && prev.stock > 0 ? prev.stock : 0,
    pack, unit: prev && prev.unit ? prev.unit : 'ks',
    dph: 'ZS', img, nameVi: viTranslate(name),
    mfg, sup: String(r.E || '').trim(), src: 'cenik',
  });
}

// hàng đang bán mà cenik không có -> GIỮ LẠI
const kept = oldProducts.filter((p) => !seen.has(String(p.ean)));
for (const p of kept) if (!gItems[String(p.ean)] && p.group) gItems[String(p.ean)] = [p.group, ''];
const merged = out.concat(kept);

writeFileSync(new URL('products.json', ROOT), JSON.stringify(merged));
groups.items = gItems;
for (const p of merged) if (groups._order.indexOf(p.group) < 0) groups._order.push(p.group);
writeFileSync(new URL('groups.json', ROOT), JSON.stringify(groups));

console.log(`feed đọc được          : ${feedFiles} file`);
console.log(`cenik -> mặt hàng      : ${out.length}  (bỏ ${stat.skip} dòng thiếu EAN/tên/giá hoặc trùng)`);
console.log(`  nối mã NSX vào tên   : ${stat.mfgAppended}`);
console.log(`  pack lấy từ feed     : ${stat.packFeed}   | đặt = 1: ${stat.packOne}`);
console.log(`  ảnh giữ từ bản cũ    : ${stat.imgOld} | lấy từ feed: ${stat.imgFeed} | không có ảnh: ${stat.imgNone}`);
console.log(`  nhóm giữ nguyên      : ${stat.grpOld} | đoán mới: ${stat.grpGuess}`);
console.log(`giữ lại ngoài cenik    : ${kept.length}`);
console.log(`products.json          : ${oldProducts.length} -> ${merged.length} mặt hàng`);
