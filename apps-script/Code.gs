// ============================================================
// VOPH — Gửi email xác nhận đơn hàng tự động (Google Apps Script)
// Dán toàn bộ file này vào script.google.com (xem NAVOD.md bước 5).
// Web gửi POST JSON → script này gửi:
//   1) Email cho KHÁCH: xác nhận đơn hàng + file PDF (có ảnh sản phẩm)
//   2) Email cho VOPH (orderEmail): đơn hàng + file Excel .xlsx + PDF
// ============================================================

function doPost(e) {
  var d = JSON.parse(e.postData.contents);
  var pdf = buildPdf(d);
  var xlsx = Utilities.newBlob(
    Utilities.base64Decode(d.xlsxBase64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    d.fname
  );
  // 1) khách
  MailApp.sendEmail({
    to: d.email,
    subject: 'Potvrzení objednávky — VOPH s.r.o. (' + d.date + ')',
    htmlBody: buildHtml(d, true),
    attachments: [pdf],
    name: 'VOPH s.r.o.'
  });
  // 2) voph.cz
  MailApp.sendEmail({
    to: d.orderEmail,
    subject: 'Objednávka ' + d.date + ' — IČO ' + d.ico + (d.firma ? ' (' + d.firma + ')' : ''),
    htmlBody: buildHtml(d, false),
    attachments: [xlsx, pdf],
    name: 'Objednávkový systém VOPH',
    replyTo: d.email
  });
  return ContentService.createTextOutput('OK');
}

function fmt(n) {
  return Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(d, forCustomer) {
  var rows = d.items.map(function (it, i) {
    return '<tr style="border-bottom:1px solid #ddd">' +
      '<td style="padding:6px;color:#888">' + (i + 1) + '</td>' +
      '<td style="padding:6px">' + (it.img ? '<img src="' + esc(it.img) + '" width="52" style="max-height:52px;object-fit:contain">' : '') + '</td>' +
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

function buildPdf(d) {
  var html = '<html><head><meta charset="utf-8"></head><body>' + buildHtml(d, true) + '</body></html>';
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
