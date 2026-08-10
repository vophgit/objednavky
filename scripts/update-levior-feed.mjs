// Đọc levior-feed.xlsx (commit sẵn trong repo) → gộp vào products.json. Chạy tự động 2:15 sáng, hoặc tay: node scripts/update-levior-feed.mjs
// File phải có cùng bố cục cột như bản mẫu "levior all.xlsx": C tên, F số lượng/hộp, G đơn vị, I EAN, K nhóm hàng, N tồn kho, O ảnh, R DPH%, AF giá mua netto.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const FEED_PATH = new URL('../levior-feed.xlsx', import.meta.url);

function findEntries(buf) {
  const entries = [];
  for (let p = buf.length - 22; p >= 0; p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      const cnt = buf.readUInt16LE(p + 10);
      let off = buf.readUInt32LE(p + 16);
      for (let k = 0; k < cnt; k++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) break;
        const method = buf.readUInt16LE(off + 10);
        const csize = buf.readUInt32LE(off + 20);
        const nlen = buf.readUInt16LE(off + 28);
        const elen = buf.readUInt16LE(off + 30);
        const clen = buf.readUInt16LE(off + 32);
        const lho = buf.readUInt32LE(off + 42);
        const name = buf.toString('utf8', off + 46, off + 46 + nlen);
        entries.push({ name, method, csize, lho });
        off += 46 + nlen + elen + clen;
      }
      break;
    }
  }
  return entries;
}
function extract(buf, e) {
  const nlen = buf.readUInt16LE(e.lho + 26);
  const elen = buf.readUInt16LE(e.lho + 28);
  const start = e.lho + 30 + nlen + elen;
  const data = buf.subarray(start, start + e.csize);
  return e.method === 0 ? data.toString('utf8') : inflateRawSync(data).toString('utf8');
}
const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const colIdx = (ref) => { let n = 0; for (let i = 0; i < ref.length; i++) n = n * 26 + (ref.charCodeAt(i) - 64); return n - 1; };
const COLS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE','AF'];

function loadRows(buf) {
  const entries = findEntries(buf);
  const shared = [];
  const sharedF = entries.find((f) => f.name.includes('sharedStrings'));
  if (sharedF) {
    const sx = extract(buf, sharedF);
    for (const si of sx.match(/<si>[\s\S]*?<\/si>/g) || []) {
      const ts = si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [];
      shared.push(ts.map((t) => t.replace(/<[^>]+>/g, '')).join(''));
    }
  }
  const sheetF = entries.find((f) => /worksheets\/sheet1\.xml$/.test(f.name));
  if (!sheetF) throw new Error('levior-feed.xlsx không hợp lệ (không thấy sheet1)');
  const xml = extract(buf, sheetF);
  const rowsXml = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
  return rowsXml.map((row) => {
    const cells = {};
    for (const c of row.match(/<c [^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1];
      if (!ref) continue;
      const t = (c.match(/t="([^"]+)"/) || [])[1];
      let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      if (t === 's') v = shared[+v];
      if (t === 'inlineStr') v = (c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
      if (v != null) cells[ref] = dec(String(v));
    }
    return cells;
  });
}
// Bảng marže (markup trên giá mua netto) — theo khoảng giá mua.
function priceFromPurchase(purchase) {
  let m;
  if (purchase < 20) m = 0.55;
  else if (purchase < 50) m = 0.5;
  else if (purchase < 100) m = 0.4;
  else if (purchase < 200) m = 0.35;
  else if (purchase < 400) m = 0.3;
  else m = 0.25;
  return Math.round(purchase * (1 + m) * 100) / 100;
}

if (!existsSync(FEED_PATH)) {
  console.log('Bỏ qua — chưa có levior-feed.xlsx trong repo (commit file này ở gốc dự án để bật cập nhật tự động).');
  process.exit(0);
}
const w = {};
new Function('window', readFileSync(new URL('../translate-vi.js', import.meta.url), 'utf8'))(w);
const viTranslate = w.viTranslate || (() => '');

let oldProducts = [];
try { oldProducts = JSON.parse(readFileSync(new URL('../products.json', import.meta.url), 'utf8')); } catch (e) {}
const oldByEan = {};
for (const p of oldProducts) oldByEan[p.ean] = p;

const rows = loadRows(readFileSync(FEED_PATH));
const levior = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const ean = r.I;
  if (!ean) continue;
  const n = parseInt(r.N || '0', 10) || 0;
  if (n <= 0) continue; // chỉ hàng còn tồn kho
  const purchase = parseFloat(r.AF) || 0;
  const existing = oldByEan[ean];
  const price = existing && existing.price > 0 ? existing.price : priceFromPurchase(purchase);
  const vatPct = parseFloat(r.R) || 21;
  const name = r.C || '';
  levior.push({
    code: r.D || r.A || '',
    ean: String(ean).replace(/\.0+$/, ''),
    name,
    group: r.K || 'Ostatní',
    price,
    stock: n,
    pack: parseInt(r.F || '1', 10) || 1,
    unit: r.G || 'ks',
    dph: vatPct === 21 ? 'ZS' : 'SS',
    img: r.O || '',
    nameVi: viTranslate(name),
    mfgCode: r.A || '',
    src: 'levior',
  });
}
if (levior.length < 10) throw new Error('levior-feed.xlsx chỉ có ' + levior.length + ' mặt hàng còn tồn kho — không ghi đè (có thể file lỗi/sai cột).');

// Giữ nguyên mặt hàng từ nguồn khác (voph.cz); EAN trùng thì voph.cz ưu tiên.
const otherEans = new Set(oldProducts.filter((p) => p.src !== 'levior').map((p) => p.ean));
const finalLevior = levior.filter((p) => !otherEans.has(p.ean));
const merged = oldProducts.filter((p) => p.src !== 'levior').concat(finalLevior);
writeFileSync(new URL('../products.json', import.meta.url), JSON.stringify(merged));
console.log('OK — ' + finalLevior.length + ' mặt hàng Levior (còn tồn kho), tổng products.json: ' + merged.length + '.');
