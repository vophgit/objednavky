// Minimal client-side XLSX writer (stored zip). window.buildOrderXlsx(rows) -> Blob
// rows: [{ean:Number, qty:Number, price:Number}]
(function(){
var CRC=(function(){var t=[],c;for(var n=0;n<256;n++){c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return function(u8){var c=0xFFFFFFFF;for(var i=0;i<u8.length;i++)c=t[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}})();
function enc(s){return new TextEncoder().encode(s)}
function zip(files){ // files: [{name, data(Uint8Array)}]
  var parts=[],central=[],offset=0;
  files.forEach(function(f){
    var name=enc(f.name),crc=CRC(f.data),sz=f.data.length;
    var lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(8,0,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,sz,true);lh.setUint32(22,sz,true);
    lh.setUint16(26,name.length,true);
    parts.push(new Uint8Array(lh.buffer),name,f.data);
    var ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(10,0,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,sz,true);ch.setUint32(24,sz,true);
    ch.setUint16(28,name.length,true);ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),name);
    offset+=30+name.length+sz;
  });
  var cdSize=central.reduce(function(a,p){return a+p.length},0);
  var eo=new DataView(new ArrayBuffer(22));
  eo.setUint32(0,0x06054b50,true);eo.setUint16(8,files.length,true);eo.setUint16(10,files.length,true);
  eo.setUint32(12,cdSize,true);eo.setUint32(16,offset,true);
  return new Blob(parts.concat(central,[new Uint8Array(eo.buffer)]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
window.buildOrderXlsx=function(rows){
  var body='<row r="1"><c r="A1" t="inlineStr"><is><t>EAN</t></is></c><c r="B1" t="inlineStr"><is><t>Mno\u017estv\u00ed</t></is></c><c r="C1" t="inlineStr"><is><t>Prodejn\u00ed cena netto</t></is></c></row>';
  rows.forEach(function(r,i){
    var n=i+2;
    body+='<row r="'+n+'"><c r="A'+n+'"><v>'+r.ean+'</v></c><c r="B'+n+'"><v>'+r.qty+'</v></c><c r="C'+n+'"><v>'+r.price+'</v></c></row>';
  });
  var sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+body+'</sheetData></worksheet>';
  var files=[
    {name:'[Content_Types].xml',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>')},
    {name:'_rels/.rels',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')},
    {name:'xl/workbook.xml',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Objednavka" sheetId="1" r:id="rId1"/></sheets></workbook>')},
    {name:'xl/_rels/workbook.xml.rels',data:enc('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>')},
    {name:'xl/worksheets/sheet1.xml',data:enc(sheet)}
  ];
  return zip(files);
};
})();
