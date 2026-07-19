// Phân 7 nhóm hàng cố định (hiển thị tiếng Việt) dựa theo từ khóa trong tên nhóm/kategorie/tên hàng (tiếng Séc).
// window.mapGroup7(product) -> tên nhóm tiếng Việt
(function () {
  var G = {
    baoho: 'Đồ bảo hộ lao động',
    spoj: 'Spojovací materiál (Ốc vít – liên kết)',
    zahrada: 'Zahrada (Sân vườn)',
    hoamypham: 'Hóa mỹ phẩm',
    xaydung: 'Dụng cụ và vật tư xây dựng',
    laodong: 'Dụng cụ lao động',
    giadinh: 'Dụng cụ gia đình'
  };
  // thứ tự kiểm tra = độ ưu tiên (nhóm hẹp trước, nhóm rộng sau)
  var RULES = [
    [G.baoho, ['rukavic', 'ochran', 'respirát', 'respirator', 'roušk', 'rousk', 'brýle ochr', 'bryle ochr', 'pracovní oděv', 'pracovni odev', 'montérk', 'monterk', 'holín', 'holin', 'pracovní obuv', 'pracovni obuv', 'reflexní', 'reflexni', 'přilb', 'prilb', 'helm', 'chránič', 'chranic', 'zástěr', 'zaster', 'špunty', 'spunty', 'sluchátka ochr', 'návlek', 'navlek', 'bezpečnostní', 'bezpecnostni']],
    [G.spoj, ['spojovací', 'spojovaci', 'šroub', 'sroub', 'vrut', 'matic', 'podložk', 'podlozk', 'hmoždink', 'hmozdink', 'hřebík', 'hrebik', 'nýt', 'nyt ', 'kotv', 'závitov', 'zavitov', 'skob', 'řetěz', 'retez', 'karabin', 'lanko', 'napínák', 'napinak', 'úhelník', 'uhelnik', 'vratov']],
    [G.zahrada, ['zahrad', 'květ', 'kvet', 'truhlík', 'truhlik', 'postřik', 'postrik', 'hadic', 'zavlaž', 'zavlaz', 'semen', 'sazen', 'plot', 'pletivo', 'rýč', 'ryc ', 'hráb', 'hrab', 'motyk', 'lopat', 'sekačk', 'sekack', 'pilka na větve', 'nůžky na větve', 'nuzky na vetve', 'gril', 'krmítko', 'krmitko', 'past na', 'rohož', 'rohoz', 'substrát', 'substrat', 'hnojiv', 'zemina', 'konev']],
    [G.hoamypham, ['drogeri', 'čistič', 'cistic', 'čisticí', 'cistici', 'mýdl', 'mydl', 'šampon', 'sampon', 'prací', 'praci pr', 'aviváž', 'avivaz', 'dezinfek', 'kosmetik', 'krém', 'krem', 'gel ', 'wc ', 'osvěžovač', 'osvezovac', 'deodorant', 'zubní', 'zubni', 'kartáček', 'kartacek', 'vlhčené', 'vlhcene', 'ubrousky', 'toaletní papír', 'toaletni papir', 'papírové', 'papirove', 'savo', 'odmašť', 'odmast', 'leštěnk', 'lestenk', 'hygien']],
    [G.xaydung, ['stavebn', 'malíř', 'malir', 'štětec', 'stetec', 'váleček', 'valecek', 'špachtl', 'spachtl', 'stěrk', 'sterk', 'lepidl', 'silikon', 'pěna mont', 'pena mont', 'montážní pěn', 'montazni pen', 'tmel', 'těsněn', 'tesnen', 'barva', 'lak ', 'ředidl', 'redidl', 'penetrac', 'sádra', 'sadra', 'zednick', 'obklad', 'dlažb', 'dlazb', 'páska maler', 'paska maler', 'lepicí pásk', 'lepici pask', 'izolač', 'izolac', 'fólie', 'folie', 'plachta', 'žebřík', 'zebrik', 'míchadl', 'michadl', 'hladítk', 'hladitk']],
    [G.laodong, ['nářadí', 'naradi', 'vrták', 'vrtak', 'kladiv', 'pila ', 'pilov', 'pilník', 'pilnik', 'klíč', 'klic', 'šroubovák', 'sroubovak', 'brusk', 'brusn', 'kleště', 'kleste', 'metr ', 'svinovací', 'svinovaci', 'vodováh', 'vodovah', 'nůž odlam', 'nuz odlam', 'sekáč', 'sekac', 'svěrák', 'sverak', 'svork', 'bit ', 'bity', 'gola', 'ráčn', 'racn', 'imbus', 'kotouč', 'kotouc', 'akku', 'aku ', 'elektrick', 'nástavec', 'nastavec', 'důlčík', 'dulcik', 'palič', 'palic']],
  ];
  var norm = function (s) { return String(s || '').toLowerCase(); };
  window.GROUPS7 = [G.giadinh, G.laodong, G.hoamypham, G.baoho, G.xaydung, G.spoj, G.zahrada];
  window.mapGroup7 = function (p) {
    var hay = norm((p.cat || '') + ' | ' + (p.group || '') + ' | ' + (p.name || ''));
    for (var i = 0; i < RULES.length; i++) {
      var kws = RULES[i][1];
      for (var k = 0; k < kws.length; k++) if (hay.indexOf(kws[k]) >= 0) return RULES[i][0];
    }
    return G.giadinh; // nhóm mặc định
  };
})();
