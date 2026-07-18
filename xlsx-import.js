// Parse catalog xlsx (same layout as original: A Zkratka, B EAN, C name, D group, E price netto, F stock, G pack, H DPH)
// window.parseCatalogXlsx(arrayBuffer) -> Promise<products[]>
(function(){
function findFiles(u8){var files=[],dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);for(var p=u8.length-22;p>=0;p--){if(dv.getUint32(p,true)===0x06054b50){var cnt=dv.getUint16(p+10,true),off=dv.getUint32(p+16,true);for(var k=0;k<cnt;k++){if(dv.getUint32(off,true)!==0x02014b50)break;var method=dv.getUint16(off+10,true),csize=dv.getUint32(off+20,true),nlen=dv.getUint16(off+28,true),elen=dv.getUint16(off+30,true),clen=dv.getUint16(off+32,true),lho=dv.getUint32(off+42,true),name=new TextDecoder().decode(u8.slice(off+46,off+46+nlen));files.push({name:name,method:method,csize:csize,lho:lho});off+=46+nlen+elen+clen}break}}return files}
async function extract(u8,f){var dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),nlen=dv.getUint16(f.lho+26,true),elen=dv.getUint16(f.lho+28,true),start=f.lho+30+nlen+elen,data=u8.slice(start,start+f.csize);if(f.method===0)return new TextDecoder().decode(data);var ds=new DecompressionStream('deflate-raw');return await new Response(new Blob([data]).stream().pipeThrough(ds)).text()}
async function sheetCells(ab){
  var u8=new Uint8Array(ab),files=findFiles(u8);
  var sheetF=files.find(function(f){return /worksheets\/sheet1\.xml$/.test(f.name)})||files.find(function(f){return /worksheets\//.test(f.name)});
  if(!sheetF)throw new Error('Soubor není platný XLSX');
  var shared=[],sharedF=files.find(function(f){return f.name.indexOf('sharedStrings')>=0});
  if(sharedF){var sx=await extract(u8,sharedF),m=sx.match(/<si>[\s\S]*?<\/si>/g)||[];m.forEach(function(si){var ts=si.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[];shared.push(ts.map(function(t){return t.replace(/<[^>]+>/g,'')}).join(''))})}
  var xml=await extract(u8,sheetF),rows=xml.match(/<row[^>]*>[\s\S]*?<\/row>/g)||[];
  function dec(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")}
  return rows.map(function(row){
    var cells={},cs=row.match(/<c [^>]*(?:\/>|>[\s\S]*?<\/c>)/g)||[];
    cs.forEach(function(c){var ref=(c.match(/r="([A-Z]+)\d+"/)||[])[1];if(!ref)return;var t=(c.match(/t="([^"]+)"/)||[])[1];var v=(c.match(/<v>([\s\S]*?)<\/v>/)||[])[1];if(t==='s')v=shared[+v];if(t==='inlineStr')v=(c.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1];if(v!=null)cells[ref]=dec(String(v))});
    return cells;
  });
}
// Generic: window.parseXlsxRows(arrayBuffer) -> Promise<string[][]> (rows as arrays A,B,C…)
window.parseXlsxRows=async function(ab){
  var rows=await sheetCells(ab);
  var colIdx=function(ref){var n=0;for(var i=0;i<ref.length;i++)n=n*26+(ref.charCodeAt(i)-64);return n-1};
  return rows.map(function(cells){
    var arr=[];
    Object.keys(cells).forEach(function(ref){arr[colIdx(ref)]=cells[ref]});
    return arr;
  });
};
window.parseCatalogXlsx=async function(ab){
  var u8=new Uint8Array(ab),files=findFiles(u8);
  var sheetF=files.find(function(f){return /worksheets\/sheet1\.xml$/.test(f.name)})||files.find(function(f){return /worksheets\//.test(f.name)});
  if(!sheetF)throw new Error('Soubor není platný XLSX');
  var shared=[],sharedF=files.find(function(f){return f.name.indexOf('sharedStrings')>=0});
  if(sharedF){var sx=await extract(u8,sharedF),m=sx.match(/<si>[\s\S]*?<\/si>/g)||[];m.forEach(function(si){var ts=si.match(/<t[^>]*>([\s\S]*?)<\/t>/g)||[];shared.push(ts.map(function(t){return t.replace(/<[^>]+>/g,'')}).join(''))})}
  var xml=await extract(u8,sheetF),rows=xml.match(/<row[^>]*>[\s\S]*?<\/row>/g)||[],out=[];
  function dec(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")}
  for(var i=1;i<rows.length;i++){
    var cells={},cs=rows[i].match(/<c [^>]*(?:\/>|>[\s\S]*?<\/c>)/g)||[];
    cs.forEach(function(c){var ref=(c.match(/r="([A-Z]+)\d+"/)||[])[1];if(!ref)return;var t=(c.match(/t="([^"]+)"/)||[])[1];var v=(c.match(/<v>([\s\S]*?)<\/v>/)||[])[1];if(t==='s')v=shared[+v];if(t==='inlineStr')v=(c.match(/<t[^>]*>([\s\S]*?)<\/t>/)||[])[1];if(v!=null)cells[ref]=dec(String(v))});
    if(!cells.B||!cells.C)continue;
    out.push({code:cells.A||'',ean:String(cells.B).replace(/\.0+$/,''),name:cells.C,group:cells.D||'Ostatní',price:Math.round(parseFloat(cells.E||'0')*100)/100,stock:parseInt(cells.F||'0',10)||0,pack:parseInt(cells.G||'1',10)||1,dph:cells.H||'ZS'});
  }
  if(!out.length)throw new Error('V souboru nebyly nalezeny žádné položky');
  return out;
};
})();
