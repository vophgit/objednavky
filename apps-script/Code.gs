// ============================================================
// VOPH — Gửi email xác nhận đơn hàng tự động (Google Apps Script)
// Dán toàn bộ file này vào script.google.com (xem NAVOD.md bước 5).
// Web gửi POST JSON → script này gửi:
//   1) Email cho KHÁCH: xác nhận đơn hàng + file PDF (có ảnh sản phẩm)
//   2) Email cho VOPH (orderEmail): đơn hàng + file Excel .xlsx + PDF
// ============================================================

function doGet(e) {
  return ContentService.createTextOutput('VOPH objednávkový systém běží. Toto je jen informační stránka — objednávky se odesílají přes doPost.');
}

// Chạy khi ai đó mở link /exec trực tiếp trên trình duyệt (GET) — chỉ để kiểm tra deploy còn sống, KHÔNG liên quan đến việc gửi đơn hàng (đơn hàng luôn dùng doPost).
function doGet(e) {
  return ContentService.createTextOutput('VOPH objednávkový skript běží. OK.');
}

function doPost(e) {
  if (!e || !e.postData) throw new Error('Nespouštějte doPost ručně — v rozbalovací nabídce vedle Run vyberte funkci "testEmail". / Đừng chạy doPost bằng tay — hãy chọn hàm "testEmail" trong ô chọn cạnh nút Run.');
  var d = JSON.parse(e.postData.contents);
  // Uložení rozpracovaného košíku (ještě neodesláno, nebo chyba odeslání) — jen zápis do listu, žádný e-mail.
  if (d.type === 'draft') { saveDraft(d); return ContentService.createTextOutput('OK'); }
  var pdf = buildPdf(d); // PDF bez obrázků — lehké, nehrozí limit velikosti přílohy
  var xlsx = Utilities.newBlob(
    Utilities.base64Decode(d.xlsxBase64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    d.fname
  );
  // Lưu file NGAY LẬP TỨC vào Drive + ghi log — đơn hàng luôn được lưu lại dù email sau đó có gửi lỗi hay không.
  var files = saveOrderFiles(d, xlsx, pdf);
  logOrder(d, files);
  clearDraft(d.session);
  var errors = [];
  if (files.error) errors.push(files.error);
  // 1) khách
  try {
    // Obsah e-mailu už má stejné informace a fotky jako PDF — příloha proto není potřeba.
    MailApp.sendEmail({
      to: d.email,
      subject: 'Potvrzení objednávky — VOPH s.r.o. (' + d.date + ')',
      htmlBody: buildHtml(d, true),
      name: 'VOPH s.r.o.'
    });
  } catch (err) { errors.push('customer: ' + err); }
  // 2) voph.cz — chỉ cần file Excel
  try {
    sendSafe({
      to: d.orderEmail,
      subject: 'Objednávka ' + d.date + ' — IČO ' + d.ico + (d.firma ? ' (' + d.firma + ')' : ''),
      htmlBody: buildHtml(d, false),
      attachments: [xlsx],
      name: 'Objednávkový systém VOPH',
      replyTo: d.email
    }, files, ['xlsxUrl']);
  } catch (err) { errors.push('voph: ' + err); }
  if (errors.length) markLogError(d, errors.join(' | '));
  return ContentService.createTextOutput('OK');
}

// Gửi email an toàn: nếu tổng dung lượng đính kèm vượt ngưỡng (Gmail giới hạn ~25MB/email), bỏ đính kèm và chèn link Drive thay thế.
function sendSafe(opts, files, linkKeys) {
  var total = 0;
  (opts.attachments || []).forEach(function (a) { total += a.getBytes().length; });
  if (total > 20 * 1024 * 1024) {
    var links = (linkKeys || ['pdfUrl', 'xlsxUrl']).filter(function (k) { return files[k]; })
      .map(function (k) { return '<a href="' + files[k] + '">' + (k === 'pdfUrl' ? 'PDF' : 'XLSX') + '</a>'; });
    opts.htmlBody += '<p style="color:#c0392b"><strong>Pozn.:</strong> Příloha byla příliš velká na e-mail, soubor je zde: ' + links.join(' · ') + '</p>';
    delete opts.attachments;
  }
  MailApp.sendEmail(opts);
}

// Sổ ghi mọi đơn hàng vào Google Sheet — dùng để tra lại khi email bị lỗi/thất lạc.
function getLogSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('LOG_SHEET_ID');
  var ss = null;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('VOPH — Log objednávek');
    props.setProperty('LOG_SHEET_ID', ss.getId());
    var sh = ss.getSheets()[0];
    sh.setName('Objednávky');
    sh.appendRow(['Čas', 'IČO', 'Firma', 'E-mail', 'Telefon', 'Adresa', 'Celkem s DPH', 'Ks', 'Položky (JSON)', 'Chyba', 'XLSX', 'PDF']);
    sh.setFrozenRows(1);
  }
  return ss;
}
function getLogSheet() {
  var ss = getLogSpreadsheet();
  return ss.getSheetByName('Objednávky') || ss.getSheets()[0];
}

// List riêng cho giỏ hàng CHƯA gửi hoặc gửi LỖI — cho phép kiểm tra đơn khách đang nhập dở.
function getDraftSheet() {
  var ss = getLogSpreadsheet();
  var sh = ss.getSheetByName('Rozpracované (koš)');
  if (!sh) {
    sh = ss.insertSheet('Rozpracované (koš)');
    sh.appendRow(['Session', 'Poslední změna', 'Stav', 'IČO', 'Firma', 'E-mail', 'Telefon', 'Adresa', 'Celkem s DPH', 'Ks', 'Položky (JSON)']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function saveDraft(d) {
  var session = d.session || '';
  if (!session) return;
  try {
    var sh = getDraftSheet();
    var row = [session, new Date(), d.status || 'Rozpracováno', d.ico || '', d.firma || '', d.email || '', d.telefon || '', d.adresa || '', d.totalVat || '', d.pieces || '', JSON.stringify(d.items || [])];
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === session) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return; }
    }
    sh.appendRow(row);
  } catch (err) {}
}

// Xóa dòng nháp khi đơn đã thực sự được gửi/lưu thành công.
function clearDraft(session) {
  if (!session) return;
  try {
    var sh = getDraftSheet();
    var data = sh.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === session) sh.deleteRow(i + 1);
    }
  } catch (err) {}
}

// Thư mục Drive lưu bản gốc XLSX + PDF của mọi đơn hàng (backup khi email lỗi hoặc quá dung lượng).
function getOrderFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('ORDER_FOLDER_ID');
  var folder = null;
  if (id) {
    try { folder = DriveApp.getFolderById(id); } catch (e) { folder = null; }
  }
  if (!folder) {
    folder = DriveApp.createFolder('VOPH — Soubory objednávek');
    props.setProperty('ORDER_FOLDER_ID', folder.getId());
  }
  return folder;
}

function saveOrderFiles(d, xlsx, pdf) {
  var out = { xlsxUrl: '', pdfUrl: '', error: '' };
  try {
    var folder = getOrderFolder();
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Prague', 'yyyy-MM-dd_HH-mm-ss');
    var base = stamp + '_' + (d.ico || 'bez-ico');
    out.xlsxUrl = folder.createFile(xlsx.copyBlob().setName(base + '_' + d.fname)).getUrl();
    out.pdfUrl = folder.createFile(pdf.copyBlob().setName(base + '_objednavka.pdf')).getUrl();
  } catch (err) {
    // Lỗi lưu Drive không làm hỏng cả đơn hàng (log/email vẫn tiếp tục) nhưng được ghi lại để không bị im lặng bỏ qua.
    out.error = 'Drive: ' + err;
  }
  return out;
}

function logOrder(d, files) {
  try {
    getLogSheet().appendRow([
      new Date(), d.ico || '', d.firma || '', d.email || '', d.telefon || '', d.adresa || '',
      d.totalVat || '', d.pieces || '', JSON.stringify(d.items || []), (files && files.error) || '',
      (files && files.xlsxUrl) || '', (files && files.pdfUrl) || ''
    ]);
  } catch (err) {
    // Không để lỗi ghi log làm hỏng cả đơn hàng.
  }
}

function markLogError(d, msg) {
  try {
    var sh = getLogSheet();
    var last = sh.getLastRow();
    sh.getRange(last, 10).setValue(msg);
  } catch (err) {}
}

// Mở nhanh sổ log / thư mục file: Run → openLogSheet (xem URL trong log kết quả).
function openLogSheet() {
  Logger.log('Sheet: ' + getLogSheet().getParent().getUrl());
  Logger.log('Folder: ' + getOrderFolder().getUrl());
}

function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(d, forCustomer, includeImages, resizeForPdf) {
  if (includeImages === undefined) includeImages = true;
  var rows = d.items.map(function (it, i) {
    var imgSrc = it.img ? (resizeForPdf ? pdfThumbUrl(it.img) : it.img) : '';
    return '<tr style="border-bottom:1px solid #ddd">' +
      '<td style="padding:6px;color:#888">' + (i + 1) + '</td>' +
      '<td style="padding:6px">' + (includeImages && it.img ? '<img src="' + esc(imgSrc) + '" width="52" style="max-height:52px;object-fit:contain">' : '') + '</td>' +
      '<td style="padding:6px"><strong>' + esc(it.name) + '</strong>' +
        (it.nameVi ? '<br><span style="color:#777;font-size:12px">' + esc(it.nameVi) + '</span>' : '') +
        '<br><span style="color:#999;font-size:11px">Kód ' + esc(it.code) + ' · EAN ' + esc(it.ean) + '</span></td>' +
      '<td style="padding:6px;text-align:center;white-space:nowrap"><strong>' + it.qty + '</strong> ks</td>' +
      '<td style="padding:6px;text-align:right;white-space:nowrap">' + fmt(it.priceVat) + ' Kč</td>' +
      '<td style="padding:6px;text-align:right;white-space:nowrap"><strong>' + fmt(it.qty * it.priceVat) + ' Kč</strong></td></tr>';
  }).join('');
  var intro = forCustomer
    ? '<p>Dobrý den,</p><p>děkujeme za Vaši objednávku. Níže naleznete její potvrzení, kopie je v příloze (PDF).</p>' +
      '<p style="color:#777">Cảm ơn quý khách đã đặt hàng. Xác nhận đơn hàng ở bên dưới, bản PDF đính kèm.</p>'
    : '<p><strong>Nová objednávka z webu.</strong> Soubor XLSX pro import je v příloze.</p>';
  return '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:760px">' +
    '<h2 style="color:#0b7a3e;margin:0 0 4px">VOPH s.r.o. — ' + (forCustomer ? 'Potvrzení objednávky' : 'Objednávka') + '</h2>' +
    '<p style="color:#888;margin:0 0 14px">' + esc(d.date) + '</p>' + intro +
    '<table style="border-collapse:collapse;margin:10px 0;font-size:13px">' +
      '<tr><td style="padding:3px 14px 3px 0;color:#777">IČO</td><td><strong>' + esc(d.ico) + '</strong>' + (d.firma ? ' — ' + esc(d.firma) : '') + '</td></tr>' +
      '<tr><td style="padding:3px 14px 3px 0;color:#777">Dodací adresa</td><td>' + esc(d.adresa) + '</td></tr>' +
      '<tr><td style="padding:3px 14px 3px 0;color:#777">Telefon</td><td>' + esc(d.telefon) + '</td></tr>' +
      '<tr><td style="padding:3px 14px 3px 0;color:#777">E-mail</td><td>' + esc(d.email) + '</td></tr>' +
    '</table>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
      '<tr style="background:#f2f2f2"><th style="padding:6px;text-align:left">#</th><th></th><th style="padding:6px;text-align:left">Položka</th><th style="padding:6px">Množství</th><th style="padding:6px;text-align:right">Cena s DPH</th><th style="padding:6px;text-align:right">Celkem</th></tr>' +
      rows +
    '</table>' +
    '<p style="text-align:right;font-size:16px;margin:14px 0"><strong>Celkem: ' + fmt(d.totalVat) + ' Kč s DPH</strong> (' + d.pieces + ' ks)</p>' +
    (forCustomer ? '<p style="color:#777;font-size:12px">V případě dotazů odpovězte na tento e-mail nebo pište na ' + esc(d.orderEmail) + '.</p>' : '') +
    '</div>';
}

// Ảnh gốc từ feed thường vài trăm KB–vài MB; PDF nhúng nguyên bản gốc (không theo width hiển thị) nên đơn nhiều dòng dễ vượt giới hạn đính kèm.
// Thu nhỏ + nén qua proxy ảnh miễn phí trước khi nhúng vào PDF — mỗi ảnh còn vài KB, an toàn dù đơn có hàng trăm dòng.
function pdfThumbUrl(url) {
  return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, '')) + '&w=80&h=80&fit=cover&q=60';
}

// Đơn có nhiều dòng (>60): PDF bỏ hẳn ảnh — vừa tránh dung lượng, vừa tránh script chạy quá lâu khi tải hàng trăm ảnh. Ảnh sản phẩm vẫn luôn hiển thị đầy đủ trong nội dung e-mail (không bị giới hạn này).
function buildPdf(d) {
  var many = (d.items || []).length > 60;
  var html = '<html><head><meta charset="utf-8"></head><body>' +
    (many ? '<p style="color:#888;font-size:12px">Fotografie položek najdete v e-mailu níže.</p>' : '') +
    buildHtml(d, true, !many, true) + '</body></html>';
  return Utilities.newBlob(html, 'text/html', 'objednavka.html')
    .getAs('application/pdf')
    .setName('potvrzeni_objednavky.pdf');
}

// Test nhanh trong editor: Run → testEmail (điền email của bạn)
function testEmail() {
  var d = {
    ico: '12345678', firma: 'Test s.r.o.', adresa: 'Testovací 1, Praha', telefon: '777123456',
    email: Session.getActiveUser().getEmail(), orderEmail: Session.getActiveUser().getEmail(),
    date: new Date().toLocaleString('cs-CZ'),
    items: [{ ean: '8595137022626', code: '025625', name: 'SADA těsnění T2/262A', nameVi: 'Bộ gioăng T2/262A', qty: 2, price: 69.6, priceVat: 84.22, img: '' }],
    totalVat: 168.43, pieces: 2, fname: 'test.xlsx',
    xlsxBase64: Utilities.base64Encode(Utilities.newBlob('test').getBytes())
  };
  doPost({ postData: { contents: JSON.stringify(d) } });
}
