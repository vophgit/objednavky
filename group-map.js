// Phân 8 nhóm hàng cố định (hiển thị tiếng Việt) dựa theo từ khóa trong tên nhóm/kategorie/tên hàng (tiếng Séc).
// window.mapGroup7(product) -> tên nhóm tiếng Việt; window.GROUPS7 = thứ tự hiển thị
(function () {
  var G = {
    laodong: 'Dụng cụ lao động',
    xaydung: 'Dụng cụ và vật liệu xây dựng',
    son: 'Sơn – silikon',
    spoj: 'Ốc vít và vật tư liên kết',
    baoho: 'Đồ bảo hộ lao động',
    zahrada: 'Đồ làm vườn (Zahrada)',
    giadinh: 'Dụng cụ gia đình',
    hoamypham: 'Hóa mỹ phẩm'
  };
  // thứ tự kiểm tra = độ ưu tiên (nhóm hẹp trước, nhóm rộng sau)
  var RULES = [
    [G.baoho, ['rukavic', 'ochran', 'respirát', 'respirator', 'roušk', 'rousk', 'brýle ochr', 'bryle ochr', 'pracovní oděv', 'pracovni odev', 'montérk', 'monterk', 'holín', 'holin', 'pracovní obuv', 'pracovni obuv', 'reflexní', 'reflexni', 'přilb', 'prilb', 'helm', 'chránič', 'chranic', 'zástěr', 'zaster', 'špunty', 'spunty', 'sluchátka ochr', 'návlek', 'navlek', 'bezpečnostní', 'bezpecnostni']],
    [G.spoj, ['spojovací', 'spojovaci', 'šroub', 'sroub', 'vrut', 'matic', 'podložk', 'podlozk', 'hmoždink', 'hmozdink', 'hřebík', 'hrebik', 'nýt', 'nyt ', 'kotv', 'závitov', 'zavitov', 'skob', 'řetěz', 'retez', 'karabin', 'lanko', 'napínák', 'napinak', 'úhelník', 'uhelnik', 'vratov']],
    [G.son, ['silikon', 'barva', 'barvy', 'lak ', 'laky', 'ředidl', 'redidl', 'penetrac', 'tmel', 'sprej barv', 'email', 'lazur', 'napouštědl', 'napoustedl', 'odrezov', 'základní nátěr', 'zakladni nater', 'nátěr', 'nater', 'pěna mont', 'pena mont', 'montážní pěn', 'montazni pen']],
    [G.zahrada, ['zahrad', 'květ', 'kvet', 'truhlík', 'truhlik', 'postřik', 'postrik', 'hadic', 'zavlaž', 'zavlaz', 'semen', 'sazen', 'plot', 'pletivo', 'rýč', 'ryc ', 'hráb', 'hrab', 'motyk', 'lopat', 'sekačk', 'sekack', 'pilka na větve', 'nůžky na větve', 'nuzky na vetve', 'gril', 'krmítko', 'krmitko', 'past na', 'rohož', 'rohoz', 'substrát', 'substrat', 'hnojiv', 'zemina', 'konev']],
    [G.hoamypham, ['drogeri', 'čistič', 'cistic', 'čisticí', 'cistici', 'mýdl', 'mydl', 'šampon', 'sampon', 'prací', 'praci pr', 'aviváž', 'avivaz', 'dezinfek', 'kosmetik', 'krém', 'krem', 'gel ', 'wc čistič', 'wc cistic', 'wc gel', 'wc blok', 'wc závěs', 'wc zaves', 'čistič wc', 'cistic wc', 'osvěžovač', 'osvezovac', 'deodorant', 'zubní', 'zubni', 'kartáček', 'kartacek', 'vlhčené', 'vlhcene', 'ubrousky', 'toaletní papír', 'toaletni papir', 'papírové', 'papirove', 'savo', 'odmašť', 'odmast', 'leštěnk', 'lestenk', 'hygien']],
    [G.xaydung, ['stavebn', 'malíř', 'malir', 'štětec', 'stetec', 'váleček', 'valecek', 'špachtl', 'spachtl', 'stěrk', 'sterk', 'lepidl', 'těsněn', 'tesnen', 'sádra', 'sadra', 'zednick', 'obklad', 'dlažb', 'dlazb', 'páska maler', 'paska maler', 'lepicí pásk', 'lepici pask', 'izolač', 'izolac', 'fólie', 'folie', 'plachta', 'žebřík', 'zebrik', 'míchadl', 'michadl', 'hladítk', 'hladitk']],
    [G.laodong, ['nářadí', 'naradi', 'vrták', 'vrtak', 'kladiv', 'pila ', 'pilov', 'pilník', 'pilnik', 'klíč', 'klic', 'šroubovák', 'sroubovak', 'brusk', 'brusn', 'kleště', 'kleste', 'metr ', 'svinovací', 'svinovaci', 'vodováh', 'vodovah', 'nůž odlam', 'nuz odlam', 'sekáč', 'sekac', 'svěrák', 'sverak', 'svork', 'bit ', 'bity', 'gola', 'ráčn', 'racn', 'imbus', 'kotouč', 'kotouc', 'akku', 'aku ', 'elektrick', 'nástavec', 'nastavec', 'důlčík', 'dulcik', 'palič', 'palic']],
  ];
  var norm = function (s) { return String(s || '').toLowerCase(); };
  window.GROUPS7 = [G.laodong, G.xaydung, G.son, G.spoj, G.baoho, G.zahrada, G.giadinh, G.hoamypham];
  // tên nhóm gốc cụ thể -> nhóm (khi kategorie đã rõ thì không đoán theo tên hàng nữa)
  var CAT_DIRECT = { 'těsněn': G.xaydung, 'tesnen': G.xaydung, 'instalatér': G.xaydung, 'instalater': G.xaydung, 'voda-topení': G.xaydung, 'voda-topeni': G.xaydung, 'sanit': G.xaydung };
  // từ khóa ưu tiên tuyệt đối (kiểm tra trước mọi rule — tránh "šroubovák" dính "šroub")
  var PRIORITY = [['šroubovák', G.laodong], ['sroubovak', G.laodong], ['klíč na matice', G.laodong], ['klic na matice', G.laodong]];
  var match = function (hay) {
    for (var j = 0; j < PRIORITY.length; j++) if (hay.indexOf(PRIORITY[j][0]) >= 0) return PRIORITY[j][1];
    for (var i = 0; i < RULES.length; i++) {
      var kws = RULES[i][1];
      for (var k = 0; k < kws.length; k++) if (hay.indexOf(kws[k]) >= 0) return RULES[i][0];
    }
    return null;
  };
  window.mapGroup7 = function (p) {
    var cat = norm((p.cat || '') + ' | ' + (p.group || ''));
    // 1) nhóm gốc đặc biệt — quyết định luôn, bỏ qua tên hàng
    for (var key in CAT_DIRECT) if (cat.indexOf(key) >= 0) return CAT_DIRECT[key];
    // 2) khớp theo kategorie gốc trước
    var g = match(cat);
    if (g) return g;
    // 3) cuối cùng mới đoán theo tên hàng
    return match(norm(p.name || '')) || G.giadinh;
  };
  // tên nhóm cũ (groups.json đã lưu) -> tên mới
  window.GROUP_RENAME = {
    'Spojovací materiál (Ốc vít – liên kết)': G.spoj,
    'Zahrada (Sân vườn)': G.zahrada,
    'Dụng cụ và vật tư xây dựng': G.xaydung
  };
})();
