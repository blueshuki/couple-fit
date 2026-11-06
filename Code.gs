/**
 * 兩人減脂 — 雲端後端（Google Apps Script）  版本 2.0.0
 *
 * 功能：資料同步、AI 辨識（食物照片／文字／營養標示／體組成報告）、
 *       iPhone 捷徑體重同步、體態照片（存 Google 雲端硬碟）、LINE 提醒與應援。
 *
 * 指令碼屬性（專案設定 → 指令碼屬性）：
 *   APP_TOKEN       必填，你們的通關密語（16 碼以上）
 *   GEMINI_API_KEY  AI 功能用，https://aistudio.google.com/apikey
 *   GEMINI_MODEL    選填，逗號分隔的備援模型清單
 *   LINE_TOKEN      選填，LINE Messaging API 的 Channel access token
 *   （LINE_USER_A / LINE_USER_B 會在 LINE 傳「綁定 A 通關密語」時自動寫入）
 *
 * 專案設定裡的「時區」請設成 (GMT+08:00) 台北。
 * 部署：網頁應用程式 → 執行身分「我」→ 誰可以存取「所有人」。
 * 修改程式後：管理部署作業 → 編輯 → 版本「新版本」，網址不變。
 */

var SHEET_NAME = 'records';
var HEADERS = ['id', 'uid', 'type', 'date', 'updatedAt', 'deleted', 'serverTs', 'json'];
var NCOL = HEADERS.length;
var DEFAULT_MODELS = 'gemini-flash-latest,gemini-flash-lite-latest,gemini-2.5-flash';
var TZ = 'Asia/Taipei';
var PHOTO_FOLDER = '兩人減脂照片';

/** 第一次（以及從 v1 升級時）請手動執行一次：授權＋建立工作表＋檢查設定 */
function setup() {
  var sh = getSheet_();
  var props = PropertiesService.getScriptProperties();
  var tok = props.getProperty('APP_TOKEN');
  Logger.log('工作表：' + sh.getName() + '（已就緒）');
  Logger.log('APP_TOKEN：' + (tok ? (tok.length < 12 ? '已設定，但太短，建議 16 碼以上' : '已設定') : '❌ 尚未設定'));
  Logger.log('GEMINI_API_KEY：' + (props.getProperty('GEMINI_API_KEY') ? '已設定' : '未設定（AI 不可用）'));
  Logger.log('LINE_TOKEN：' + (props.getProperty('LINE_TOKEN') ? '已設定' : '未設定（LINE 提醒不可用）'));
  var folder = photoFolder_();
  Logger.log('照片資料夾：' + folder.getName() + '（已就緒）');
  Logger.log('時區：' + Session.getScriptTimeZone() + (Session.getScriptTimeZone() === TZ ? '' : '（建議到專案設定改成台北）'));
}

function doGet() { return json_({ ok: true, msg: '兩人減脂 API 運作中。' }); }

function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (req && Array.isArray(req.events)) return handleLine_(req); // LINE webhook
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('APP_TOKEN');
    if (!token) return json_({ ok: false, error: '後端尚未設定 APP_TOKEN（指令碼屬性）' });
    if (String(req.token || '').trim() !== token) return json_({ ok: false, error: '通關密語錯誤' });
    switch (req.action) {
      case 'ping': return json_({ ok: true, serverTime: Date.now(), ai: !!props.getProperty('GEMINI_API_KEY'), drive: driveOk_(), line: lineStatus_(props) });
      case 'push': return json_(push_(req.records || []));
      case 'pull': return json_(pull_(Number(req.since) || 0));
      case 'analyze': return json_(analyze_(req, props));
      case 'health': return json_(health_(req));
      case 'photoSave': return json_(photoSave_(req));
      case 'photoGet': return json_(photoGet_(req));
      case 'notify': return json_({ ok: true, sent: linePush_(String(req.to || ''), String(req.text || '').slice(0, 300)) });
      default: return json_({ ok: false, error: '未知的動作：' + req.action });
    }
  } catch (err) {
    return json_({ ok: false, error: '後端錯誤：' + (err && err.message ? err.message : err) });
  }
}
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function todayTPE_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/* ---------------- 試算表 ---------------- */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('請從 Google 試算表的「擴充功能 → Apps Script」建立這個專案');
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, sh.getMaxRows(), NCOL).setNumberFormat('@');
    sh.getRange(1, 1, 1, NCOL).setValues([HEADERS]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function ensureRows_(sh, needLastRow) {
  var max = sh.getMaxRows();
  if (needLastRow > max) { var add = needLastRow - max + 500; sh.insertRowsAfter(max, add); sh.getRange(max + 1, 1, add, NCOL).setNumberFormat('@'); }
}
function cellStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function readAll_(sh) { var last = sh.getLastRow(); if (last < 2) return []; return sh.getRange(2, 1, last - 1, NCOL).getValues(); }
function parseJson_(s) { try { return JSON.parse(cellStr_(s) || '{}'); } catch (e) { return null; } }
function merge_(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }

/* 寫入（呼叫端需持有鎖） */
function upsert_(sh, rows, index, recs, now) {
  var appends = [], updates = {}, saved = 0, skipped = 0;
  for (var k = 0; k < recs.length; k++) {
    var r = recs[k];
    if (!r || !r.id || typeof r.id !== 'string' || r.id.length > 120) { skipped++; continue; }
    var upd = Number(r.updatedAt) || now;
    var data = r.data == null ? {} : r.data;
    var del = !!r.deleted;
    if (index.hasOwnProperty(r.id)) {
      var ri = index[r.id], old = rows[ri], oldUpd = Number(old[4]) || 0;
      if (String(r.type) === 'daily') { // 每日紀錄：欄位合併，避免手機與捷徑互相覆蓋
        var od = parseJson_(old[7]) || {};
        data = upd >= oldUpd ? merge_(od, data) : merge_(data, od);
        if (upd < oldUpd) { del = cellStr_(old[5]) === '1'; }
        upd = Math.max(upd, oldUpd);
      } else if (oldUpd > upd) { skipped++; continue; }
      var s1 = JSON.stringify(data); if (s1.length > 45000) { skipped++; continue; }
      rows[ri] = [r.id, String(r.uid || ''), String(r.type || ''), String(r.date || ''), String(upd), del ? '1' : '0', String(now), s1];
      updates[ri] = true;
    } else {
      var s2 = JSON.stringify(data); if (s2.length > 45000) { skipped++; continue; }
      index[r.id] = rows.length + appends.length;
      appends.push([r.id, String(r.uid || ''), String(r.type || ''), String(r.date || ''), String(upd), del ? '1' : '0', String(now), s2]);
    }
    saved++;
  }
  for (var u in updates) sh.getRange(Number(u) + 2, 1, 1, NCOL).setValues([rows[u]]);
  if (appends.length) {
    var start = sh.getLastRow() + 1; ensureRows_(sh, start + appends.length - 1);
    sh.getRange(start, 1, appends.length, NCOL).setValues(appends);
    for (var a = 0; a < appends.length; a++) rows.push(appends[a]);
  }
  return { saved: saved, skipped: skipped };
}
function withSheet_(fn) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var sh = getSheet_(); var rows = readAll_(sh); var index = {};
    for (var i = 0; i < rows.length; i++) index[cellStr_(rows[i][0])] = i;
    return fn(sh, rows, index);
  } finally { lock.releaseLock(); }
}

/* ---------------- 同步 ---------------- */
function push_(records) {
  if (!Array.isArray(records)) throw new Error('records 格式錯誤');
  if (records.length > 500) throw new Error('一次最多 500 筆');
  return withSheet_(function (sh, rows, index) {
    var now = Date.now(); var r = upsert_(sh, rows, index, records, now);
    return { ok: true, saved: r.saved, skipped: r.skipped, serverTs: now };
  });
}
function pull_(since) {
  return withSheet_(function (sh, rows) {
    var out = [], maxTs = since;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i]; var ts = Number(r[6]) || 0;
      if (ts <= since || !r[0]) continue;
      var data = parseJson_(r[7]); if (data === null) continue;
      out.push({ id: cellStr_(r[0]), uid: cellStr_(r[1]), type: cellStr_(r[2]), date: cellStr_(r[3]), updatedAt: Number(r[4]) || 0, deleted: cellStr_(r[5]) === '1', data: data });
      if (ts > maxTs) maxTs = ts;
    }
    return { ok: true, records: out, maxTs: maxTs };
  });
}
function findRecords_(rows, type, uid, date) {
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (cellStr_(r[2]) !== type || cellStr_(r[5]) === '1') continue;
    if (uid && cellStr_(r[1]) !== uid) continue; if (date && cellStr_(r[3]) !== date) continue;
    var d = parseJson_(r[7]); if (d) out.push({ id: cellStr_(r[0]), uid: cellStr_(r[1]), date: cellStr_(r[3]), data: d });
  }
  return out;
}

/* ---------------- iPhone 捷徑：體重同步 ---------------- */
function numFrom_(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  var m = String(v).replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : 0;
}
function health_(req) {
  var uid = String(req.uid || '').toUpperCase();
  if (uid !== 'A' && uid !== 'B') return { ok: false, error: 'uid 必須是 A 或 B' };
  var w = numFrom_(req.weight);
  if (/lb/i.test(String(req.weight || '')) || /lb/i.test(String(req.unit || ''))) w = w * 0.453592;
  if (!(w > 25 && w < 300)) return { ok: false, error: '體重數字不正確：' + req.weight };
  var bf = numFrom_(req.bodyfat); if (bf > 0 && bf < 1) bf = bf * 100; if (!(bf > 2 && bf < 70)) bf = 0;
  var ds = String(req.date || ''); var m = ds.match(/(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
  var date = m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : todayTPE_();
  var tm = ds.match(/[T\s](\d{1,2}):(\d{2})/);
  var patch = { weight: Math.round(w * 10) / 10, wsrc: 'health' };
  if (tm) patch.weighTime = ('0' + tm[1]).slice(-2) + ':' + tm[2];
  if (bf) patch.bf = Math.round(bf * 10) / 10;
  var id = 'd_' + uid + '_' + date;
  withSheet_(function (sh, rows, index) { upsert_(sh, rows, index, [{ id: id, uid: uid, type: 'daily', date: date, updatedAt: Date.now(), data: patch }], Date.now()); });
  return { ok: true, msg: '已同步 ' + patch.weight + ' kg' + (bf ? '、體脂 ' + patch.bf + '%' : '') + '（' + date + '）' };
}

/* ---------------- 體態照片（Google 雲端硬碟） ---------------- */
function photoFolder_() {
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
}
function driveOk_() { try { photoFolder_(); return true; } catch (e) { return false; } }
function photoSave_(req) {
  var uid = String(req.uid || ''), date = String(req.date || ''), pose = String(req.pose || '');
  if (!/^[AB]$/.test(uid) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(front|side)$/.test(pose)) return { ok: false, error: '參數錯誤' };
  var b64 = String(req.image || ''); if (!b64 || b64.length > 8000000) return { ok: false, error: '照片太大或是空的' };
  var folder = photoFolder_(); var name = 'c17_' + uid + '_' + date + '_' + pose + '.jpg';
  var old = folder.getFilesByName(name); while (old.hasNext()) old.next().setTrashed(true);
  var file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', name));
  return { ok: true, fileId: file.getId() };
}
function photoGet_(req) {
  var file = DriveApp.getFileById(String(req.fileId || ''));
  if (file.getName().indexOf('c17_') !== 0) return { ok: false, error: '不是這個 App 的照片' };
  return { ok: true, image: Utilities.base64Encode(file.getBlob().getBytes()) };
}

/* ---------------- AI ---------------- */
var PROMPT_FOOD = [
  '你是熟悉台灣飲食的營養師。請根據照片和使用者說明，辨識每一樣食物或飲料，估算「實際會吃下的」重量與營養素。',
  '規則：1. 台灣外食常有隱藏的油、勾芡、醬汁、糖，請算進去。2. 份量看不出來時，用台灣常見份量，並在 note 說明。',
  '3. 使用者說明與照片衝突時，以說明為準。4. 便當可拆成主食、主菜、配菜，最多 8 項。5. 鈉（sodium, mg）要估算，外食與湯品通常偏高。',
  '只輸出 JSON：{"items":[{"name":"繁體中文","grams":整數,"kcal":整數,"protein":數字,"carbs":數字,"fat":數字,"fiber":數字,"sodium":整數,"confidence":"高|中|低"}],"note":"一句話，指出最不確定的地方"}',
  '照片裡沒有食物時回傳 {"items":[],"note":"沒有看到食物"}。'
].join('\n');
var PROMPT_LABEL = [
  '這是一張台灣食品包裝的「營養標示」照片。請精確讀出表格數字，不要估算。',
  '台灣格式通常有：每一份量 X 公克（或毫升）、本包裝含 N 份、熱量、蛋白質、脂肪、碳水化合物、糖、鈉。若有「每100公克」與「每份」兩欄，取「每份」。',
  '只輸出 JSON：{"name":"從包裝上看得出的品名，看不出就寫空字串","servingDesc":"例如 30公克","servings":數字或0,"kcal":數字,"protein":數字,"carbs":數字,"fat":數字,"fiber":數字或0,"sodium":數字(毫克)}',
  '讀不到營養標示時回傳 {"error":"看不到營養標示"}。'
].join('\n');
var PROMPT_BODY = [
  '這是一張體脂計 App（bpt care）的身體組成報告截圖。請精確讀出數字，不要估算，沒有的項目填 null。',
  '只輸出 JSON：{"weight":體重kg,"bf":體脂率%,"muscle":肌肉量kg,"smm":骨骼肌kg,"water":水分%,"visceral":內臟脂肪等級,"bone":骨量kg,"protein":蛋白質%,"bmrS":基礎代謝kcal,"bodyAge":身體年齡}',
  '單位若是磅（lb）請換算成公斤。'
].join('\n');

function analyze_(req, props) {
  var key = props.getProperty('GEMINI_API_KEY');
  if (!key) return { ok: false, error: 'AI 尚未設定：請在 Apps Script 指令碼屬性加入 GEMINI_API_KEY' };
  var mode = String(req.mode || 'food');
  var image = String(req.image || ''), hint = String(req.hint || '').slice(0, 500);
  if (mode === 'food' && !image && !hint) return { ok: false, error: '請提供照片或文字描述' };
  if (mode !== 'food' && !image) return { ok: false, error: '請提供照片' };
  if (image.length > 8000000) return { ok: false, error: '照片太大' };
  var prompt = mode === 'label' ? PROMPT_LABEL : mode === 'body' ? PROMPT_BODY : PROMPT_FOOD + (hint ? '\n\n使用者說明：' + hint : '\n\n使用者沒有補充說明。');
  var parts = [{ text: prompt }]; if (image) parts.push({ inlineData: { mimeType: 'image/jpeg', data: image } });
  var r = gemini_(key, props, parts); if (!r.ok) return r;
  var obj = r.obj;
  if (mode === 'label') {
    if (obj.error) return { ok: true, label: null };
    var n = function (v) { v = numFrom_(v); return v > 0 ? Math.round(v * 10) / 10 : 0; };
    return { ok: true, label: { name: String(obj.name || '').slice(0, 40), servingDesc: String(obj.servingDesc || '').slice(0, 30), servings: n(obj.servings), kcal: n(obj.kcal), protein: n(obj.protein), carbs: n(obj.carbs), fat: n(obj.fat), fiber: n(obj.fiber), sodium: Math.round(numFrom_(obj.sodium)) } };
  }
  if (mode === 'body') {
    var out = {}; ['weight', 'bf', 'muscle', 'smm', 'water', 'visceral', 'bone', 'protein', 'bmrS', 'bodyAge'].forEach(function (k) { var v = numFrom_(obj[k]); if (v > 0) out[k] = Math.round(v * 10) / 10; });
    return { ok: true, body: out };
  }
  var items = Array.isArray(obj.items) ? obj.items : [];
  var p = function (v) { v = Number(v); return isFinite(v) && v > 0 ? v : 0; };
  items = items.slice(0, 12).map(function (it) {
    return { name: String(it.name || '未命名').slice(0, 40), grams: Math.round(p(it.grams)), kcal: Math.round(p(it.kcal)),
      protein: Math.round(p(it.protein) * 10) / 10, carbs: Math.round(p(it.carbs) * 10) / 10, fat: Math.round(p(it.fat) * 10) / 10,
      fiber: Math.round(p(it.fiber) * 10) / 10, sodium: Math.round(p(it.sodium)),
      confidence: ['高', '中', '低'].indexOf(it.confidence) >= 0 ? it.confidence : '中' };
  }).filter(function (it) { return it.kcal > 0 || it.protein > 0; });
  return { ok: true, items: items, note: String(obj.note || '').slice(0, 200), model: r.model };
}
function gemini_(key, props, parts) {
  var body = { contents: [{ role: 'user', parts: parts }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } };
  var models = String(props.getProperty('GEMINI_MODEL') || DEFAULT_MODELS).split(',').map(function (s) { return s.trim(); }).filter(String);
  var errors = [];
  for (var i = 0; i < models.length; i++) {
    var res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent', {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body), muteHttpExceptions: true });
    var code = res.getResponseCode(), text = res.getContentText();
    if (code === 200) { var obj = parseGemini_(text); if (obj) return { ok: true, obj: obj, model: models[i] }; errors.push(models[i] + '：回應無法解析'); continue; }
    var msg = ''; try { msg = JSON.parse(text).error.message; } catch (e) { msg = text.slice(0, 120); }
    if (code === 400 && /API key/i.test(msg)) return { ok: false, error: 'Gemini 金鑰無效，請重新確認 GEMINI_API_KEY' };
    errors.push(models[i] + '（' + code + '）：' + msg);
  }
  var quota = errors.some(function (s) { return s.indexOf('（429）') >= 0; });
  return { ok: false, error: quota ? 'AI 免費額度暫時用完或太頻繁，請過一分鐘再試（每日額度在台灣時間下午 3～4 點重置）。' : 'AI 辨識失敗：' + errors.join('；').slice(0, 300) };
}
function parseGemini_(text) {
  var j; try { j = JSON.parse(text); } catch (e) { return null; }
  var cand = j.candidates && j.candidates[0]; if (!cand || !cand.content || !cand.content.parts) return null;
  var out = cand.content.parts.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('');
  out = out.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  var s = out.indexOf('{'), e = out.lastIndexOf('}'); if (s < 0 || e < s) return null;
  try { return JSON.parse(out.slice(s, e + 1)); } catch (err) { return null; }
}

/* ---------------- LINE ---------------- */
function lineStatus_(props) { return { token: !!props.getProperty('LINE_TOKEN'), A: !!props.getProperty('LINE_USER_A'), B: !!props.getProperty('LINE_USER_B') }; }
function lineCall_(path, payload) {
  var tok = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN'); if (!tok) return false;
  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/' + path, { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + tok }, payload: JSON.stringify(payload), muteHttpExceptions: true });
  return res.getResponseCode() === 200;
}
function linePush_(uid, text) {
  if (uid !== 'A' && uid !== 'B') return false;
  var to = PropertiesService.getScriptProperties().getProperty('LINE_USER_' + uid); if (!to || !text) return false;
  return lineCall_('push', { to: to, messages: [{ type: 'text', text: text }] });
}
function handleLine_(req) {
  var props = PropertiesService.getScriptProperties(); var token = props.getProperty('APP_TOKEN');
  req.events.forEach(function (ev) {
    if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
    var t = String(ev.message.text || '').trim(); var m = t.match(/^綁定\s*([ABab])\s+(.+)$/);
    if (m) {
      var ok = token && m[2].trim() === token;
      if (ok) props.setProperty('LINE_USER_' + m[1].toUpperCase(), ev.source.userId);
      lineCall_('reply', { replyToken: ev.replyToken, messages: [{ type: 'text', text: ok ? '已綁定 ' + m[1].toUpperCase() + '。之後提醒和應援會傳到這裡。' : '通關密語不正確。' }] });
    } else if (/^解除綁定\s*([ABab])$/.test(t)) {
      var u = t.slice(-1).toUpperCase(); if (props.getProperty('LINE_USER_' + u) === ev.source.userId) props.deleteProperty('LINE_USER_' + u);
      lineCall_('reply', { replyToken: ev.replyToken, messages: [{ type: 'text', text: '已解除綁定。' }] });
    }
  });
  return ContentService.createTextOutput('OK');
}
/** 執行一次以建立定時提醒（重複執行會先清掉舊的） */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (['morningCheck', 'eveningCheck', 'weeklyReport'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('morningCheck').timeBased().everyDays(1).atHour(9).nearMinute(30).inTimezone(TZ).create();
  ScriptApp.newTrigger('eveningCheck').timeBased().everyDays(1).atHour(21).nearMinute(0).inTimezone(TZ).create();
  ScriptApp.newTrigger('weeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(20).inTimezone(TZ).create();
  Logger.log('已建立：每天 9:30 體重提醒、21:00 飲食提醒、週日 20:00 週回顧');
}
function profiles_(rows) { var o = {}; findRecords_(rows, 'profile').forEach(function (r) { o[r.uid] = r.data; }); return o; }
function remindOn_(prof, uid) { return prof[uid] && prof[uid].setup && prof[uid].remind !== false; }
function morningCheck() {
  var rows = readAll_(getSheet_()); var prof = profiles_(rows); var t = todayTPE_();
  ['A', 'B'].forEach(function (u) {
    if (!remindOn_(prof, u)) return;
    var d = findRecords_(rows, 'daily', u, t)[0];
    if (!d || !(Number(d.data.weight) > 0)) linePush_(u, '早安。今天還沒量體重，起床、上完廁所後量一次就好（量完關掉 bpt care 會自動同步）。');
  });
}
function eveningCheck() {
  var rows = readAll_(getSheet_()); var prof = profiles_(rows); var t = todayTPE_();
  ['A', 'B'].forEach(function (u) {
    if (!remindOn_(prof, u)) return;
    var n = findRecords_(rows, 'food', u, t).length;
    if (n < 2) linePush_(u, n === 0 ? '今天還沒有飲食記錄。睡前花一分鐘補上，明天的體重解讀才會準。' : '今天的飲食記錄只有 1 筆，還有沒記到的嗎？');
  });
}
function weeklyReport() {
  var rows = readAll_(getSheet_()); var prof = profiles_(rows); var end = todayTPE_();
  var days = []; for (var i = 6; i >= 0; i--) days.push(Utilities.formatDate(new Date(Date.now() - i * 86400000), TZ, 'yyyy-MM-dd'));
  var prevDays = []; for (var j = 13; j >= 7; j--) prevDays.push(Utilities.formatDate(new Date(Date.now() - j * 86400000), TZ, 'yyyy-MM-dd'));
  ['A', 'B'].forEach(function (u) {
    if (!remindOn_(prof, u)) return;
    var logged = days.filter(function (d) { return findRecords_(rows, 'food', u, d).length > 0; }).length;
    var avgW = function (ds) { var w = ds.map(function (d) { var r = findRecords_(rows, 'daily', u, d)[0]; return r ? Number(r.data.weight) || 0 : 0; }).filter(function (x) { return x > 0; }); return w.length ? w.reduce(function (a, b) { return a + b; }, 0) / w.length : 0; };
    var a = avgW(prevDays), b = avgW(days);
    var train = days.filter(function (d) { var r = findRecords_(rows, 'workout', u, d)[0]; if (!r) return false; var sets = 0; (r.data.exercises || []).forEach(function (e) { sets += (e.sets || []).filter(function (s) { return s.done; }).length; }); var cm = 0; (r.data.cardio || []).forEach(function (c) { cm += Number(c.min) || 0; }); return sets >= 6 || cm >= 20; }).length;
    var msg = '本週回顧（' + days[0].slice(5) + '–' + end.slice(5) + '）\n記錄 ' + logged + '/7 天・訓練 ' + train + ' 次';
    if (a && b) msg += '\n7 日平均體重 ' + a.toFixed(1) + ' → ' + b.toFixed(1) + ' kg（' + (b - a >= 0 ? '+' : '') + (b - a).toFixed(1) + '）';
    msg += '\n打開 App 看「下週只做一件事」。';
    linePush_(u, msg);
  });
}
