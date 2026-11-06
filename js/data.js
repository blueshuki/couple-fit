'use strict';
/* =========================================================
   兩人減脂 v2 — 資料、計算、解讀邏輯
   ========================================================= */
const APP_VERSION = '2.4.1';
const LS_KEY = 'c17_state_v1';

/* ---------- 工具 ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const r0 = n => Math.round(n || 0);
const r1 = n => Math.round((n || 0) * 10) / 10;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const z2 = n => String(n).padStart(2, '0');
function todayStr(d = new Date()) { return d.getFullYear() + '-' + z2(d.getMonth() + 1) + '-' + z2(d.getDate()); }
function addDays(s, n) { const [y, m, d] = s.split('-').map(Number); return todayStr(new Date(y, m - 1, d + n)); }
function dayNum(s) { const [y, m, d] = s.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function numToMD(n) { const d = new Date(n * 86400000); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); }
function weekday(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function prettyDate(s) {
  const t = todayStr(); if (s === t) return '今天'; if (s === addDays(t, -1)) return '昨天';
  const [, m, d] = s.split('-').map(Number); return m + '/' + d + '（' + '日一二三四五六'[weekday(s)] + '）';
}
function md(s) { const [, m, d] = s.split('-').map(Number); return m + '/' + d; }
function newId(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function nowHM() { const d = new Date(); return z2(d.getHours()) + ':' + z2(d.getMinutes()); }
function linreg(pts) {
  const n = pts.length; if (n < 2) return null;
  const mx = pts.reduce((a, p) => a + p.x, 0) / n, my = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0, sxx = 0; pts.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; });
  return sxx ? sxy / sxx : null;
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
function rangeDays(from, to) { const out = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }

/* ---------- 狀態 ---------- */
function defaultState() { return { cfg: { apiUrl: '', token: '', me: '', readCheers: [], seen: {} }, records: {}, pending: [], lastTs: 0, lastSyncAt: 0, syncErr: '' }; }
function loadState() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY));
    if (j && j.records) { const s = Object.assign(defaultState(), j); s.cfg = Object.assign(defaultState().cfg, j.cfg || {}); return s; }
  } catch (e) { }
  return defaultState();
}
let S = loadState();
function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) { toast('本機儲存空間不足，請到設定匯出備份'); } }
function put(rec) {
  rec.updatedAt = Date.now();
  S.records[rec.id] = rec;
  if (!S.pending.includes(rec.id)) S.pending.push(rec.id);
  persist(); queueSync();
}
function removeRec(id) { const r = S.records[id]; if (!r) return; r.deleted = true; put(r); }
function recs(type, uid, date) {
  const out = [];
  for (const k in S.records) {
    const r = S.records[k]; if (r.deleted || r.type !== type) continue;
    if (uid != null && r.uid !== uid) continue; if (date != null && r.date !== date) continue; out.push(r);
  }
  return out;
}

/* ---------- 人 ---------- */
const UIDS = ['A', 'B'];
const otherUid = u => u === 'A' ? 'B' : 'A';
const DEF_AVATAR = {
  A: { outfit: 'stripe', top: '#fcf5e9', bottom: '#424247', trim: '#727b80', hair: 'bob', hairColor: '#54453c', skin: '#fed9b2', expr: 'auto', no: '', jersey: 'yellow' },
  B: { outfit: 'jersey', top: '#ffd23f', bottom: '#f7f4ec', trim: '#1f2d4d', hair: 'curly', hairColor: '#5f4436', skin: '#fed4b2', expr: 'auto', no: '', jersey: 'yellow' },
};
function defProfile(uid) {
  return {
    name: uid === 'A' ? 'Inge' : '17', sex: 'F', birthYear: 1995, height: 160, startWeight: 60, goalWeight: 55,
    life: 1.35, pace: 0.5, trainDays: 3, tdeeOverride: 0, cycleLen: 28, periodLen: 5, remind: true,
    avatar: Object.assign({}, DEF_AVATAR[uid]), setup: false,
  };
}
function profile(uid) {
  const r = S.records['profile_' + uid]; const d = defProfile(uid);
  if (!r || r.deleted) return d;
  const p = Object.assign(d, r.data, { avatar: Object.assign({}, d.avatar, (r.data || {}).avatar) });
  if (!OUTFITS[p.avatar.outfit]) p.avatar.outfit = { tee: 'stripe', tank: 'sport' }[p.avatar.outfit] || 'pocket';
  return p;
}
function hasProfile(uid) { const r = S.records['profile_' + uid]; return !!(r && !r.deleted && r.data && r.data.setup); }
function saveProfile(uid, data) { put({ id: 'profile_' + uid, uid, type: 'profile', date: '', data }); }
const nameOf = uid => profile(uid).name || uid;
function age(p) { return new Date().getFullYear() - num(p.birthYear); }

/* ---------- 食物資料 ---------- */
const MEALS = ['早餐', '午餐', '點心', '晚餐', '宵夜'];
function defaultMeal() { const h = new Date().getHours() + new Date().getMinutes() / 60; if (h < 10.5) return '早餐'; if (h < 14.5) return '午餐'; if (h < 17) return '點心'; if (h < 21) return '晚餐'; return '宵夜'; }
// [名稱, 份量, kcal, 蛋白, 碳水, 脂肪, 纖維, 鈉mg, 分類]  約略值
const BUILTIN_FOODS = [
  ['白飯', '1碗 200g', 280, 8, 61, 1, 1, 0], ['白飯', '半碗 100g', 140, 4, 31, 0.5, 0.5, 0], ['糙米飯', '1碗 200g', 250, 5, 52, 2, 3.5, 5],
  ['地瓜', '中1條 200g', 180, 3, 41, 0, 6, 50], ['燕麥片', '40g', 150, 5, 27, 3, 4, 2], ['全麥吐司', '1片', 90, 4, 16, 1, 2, 150],
  ['水煮蛋', '1顆', 75, 7, 1, 5, 0, 70], ['茶葉蛋', '1顆', 75, 7, 1, 5, 0, 350], ['無糖豆漿', '400ml', 140, 14, 6, 7, 2, 80], ['鮮奶（全脂）', '240ml', 150, 8, 12, 8, 0, 100],
  ['希臘優格（無糖）', '100g', 60, 10, 4, 0.5, 0, 40], ['乳清蛋白', '1匙 30g', 120, 24, 3, 1.5, 0, 60], ['即食雞胸肉', '1包 100g', 120, 23, 2, 2, 0, 500],
  ['雞腿肉（去皮）', '100g 熟', 180, 24, 0, 9, 0, 200], ['豬里肌', '100g 熟', 170, 26, 0, 7, 0, 200], ['瘦牛肉', '100g 熟', 180, 27, 0, 7, 0, 200],
  ['鮭魚', '100g', 208, 20, 0, 13, 0, 150], ['白肉魚（鯛魚）', '100g 熟', 128, 26, 0, 3, 0, 150], ['板豆腐', '100g', 88, 8.5, 6, 3.4, 0.6, 10],
  ['毛豆仁', '100g', 125, 14, 9, 5, 6, 10], ['燙青菜（少油）', '1份', 60, 2, 5, 3.5, 2.5, 300], ['生菜沙拉（不含醬）', '1份', 30, 1, 5, 0, 2, 30],
  ['香蕉', '1根', 90, 1, 23, 0.3, 2.6, 1], ['蘋果', '1顆 200g', 105, 0.5, 28, 0.3, 4.8, 2], ['芭樂', '160g', 60, 1, 15, 0, 5, 5],
  ['無調味堅果', '1小把 15g', 90, 3, 3, 8, 1.5, 2], ['鮪魚飯糰', '1個', 210, 5, 38, 4, 1, 450], ['一般便當', '1個', 800, 30, 100, 30, 4, 1500],
  ['滷肉飯', '小碗', 330, 9, 45, 13, 0.5, 700], ['陽春乾麵', '1碗', 350, 10, 60, 7, 2, 900], ['火鍋（一人份含醬料）', '1份', 900, 45, 70, 45, 6, 3500],
  ['拿鐵（全脂）', '中杯', 185, 10, 15, 10, 0, 150], ['美式咖啡', '1杯', 10, 0.5, 1, 0, 0, 5], ['珍珠奶茶（全糖）', '700ml', 650, 3, 105, 23, 0, 150],
  ['大腸包小腸', '1份', 550, 18, 60, 26, 2, 1300, '球場'], ['炸雞排', '1片', 600, 35, 30, 37, 1, 1100, '球場'], ['烤香腸', '1根', 250, 9, 10, 19, 0, 600, '球場'],
  ['薯條', '中份', 350, 4, 45, 17, 4, 300, '球場'], ['熱狗堡', '1個', 300, 10, 30, 16, 1, 800, '球場'], ['爆米花', '中份', 400, 5, 50, 20, 7, 400, '球場'],
  ['啤酒', '330ml', 140, 1, 11, 0, 0, 10, '球場'], ['無糖茶', '1瓶', 0, 0, 0, 0, 0, 10, '球場'],
].map((a, i) => ({ id: 'bi' + i, name: a[0], unit: a[1], kcal: a[2], p: a[3], c: a[4], f: a[5], fib: a[6], na: a[7], tag: a[8] || '', builtin: true }));
const PROTEIN_PICKS = ['即食雞胸肉', '無糖豆漿', '希臘優格（無糖）', '水煮蛋', '乳清蛋白', '板豆腐', '白肉魚（鯛魚）', '毛豆仁'];

/* ---------- 運動資料 ---------- */
const EX_LIB = [
  ['槓鈴深蹲', '腿'], ['高腳杯深蹲', '腿'], ['腿推', '腿'], ['保加利亞分腿蹲', '腿'], ['弓箭步', '腿'], ['腿伸展', '腿'], ['腿彎舉', '腿'], ['小腿提踵', '腿'],
  ['羅馬尼亞硬舉', '臀/後側'], ['傳統硬舉', '臀/後側'], ['臀推', '臀/後側'], ['髖外展機', '臀/後側'], ['背伸展', '臀/後側'],
  ['槓鈴臥推', '胸'], ['啞鈴臥推', '胸'], ['上斜啞鈴臥推', '胸'], ['機械胸推', '胸'], ['蝴蝶機夾胸', '胸'], ['伏地挺身', '胸'],
  ['滑輪下拉', '背'], ['輔助引體向上', '背'], ['坐姿划船', '背'], ['啞鈴單臂划船', '背'], ['槓鈴划船', '背'], ['臉拉', '背'],
  ['啞鈴肩推', '肩'], ['機械肩推', '肩'], ['側平舉', '肩'], ['反向飛鳥', '肩'],
  ['二頭彎舉', '手臂'], ['錘式彎舉', '手臂'], ['三頭下壓', '手臂'], ['過頭三頭伸展', '手臂'],
  ['棒式', '核心', 'sec'], ['側棒式', '核心', 'sec'], ['捲腹', '核心'], ['死蟲式', '核心'], ['懸吊抬腿', '核心'], ['滾輪', '核心'],
].map(a => ({ name: a[0], part: a[1], unit: a[2] || 'reps' }));
const exUnit = name => (EX_LIB.find(e => e.name === name) || {}).unit || 'reps';
const exPart = name => (EX_LIB.find(e => e.name === name) || {}).part || '';
const TPL = {
  A: { name: '全身 A', ex: [['高腳杯深蹲', 3, '8-12'], ['啞鈴臥推', 3, '8-12'], ['滑輪下拉', 3, '10-12'], ['羅馬尼亞硬舉', 3, '8-10'], ['側平舉', 2, '12-15'], ['棒式', 3, '30-45']] },
  B: { name: '全身 B', ex: [['腿推', 3, '10-12'], ['坐姿划船', 3, '10-12'], ['啞鈴肩推', 3, '8-12'], ['臀推', 3, '8-12'], ['腿彎舉', 2, '12-15'], ['死蟲式', 3, '10-12']] },
  U1: { name: '上肢 1', ex: [['槓鈴臥推', 3, '6-10'], ['坐姿划船', 3, '8-12'], ['啞鈴肩推', 3, '8-12'], ['滑輪下拉', 3, '10-12'], ['三頭下壓', 2, '10-15'], ['二頭彎舉', 2, '10-15']] },
  L1: { name: '下肢 1', ex: [['槓鈴深蹲', 3, '6-10'], ['羅馬尼亞硬舉', 3, '8-10'], ['腿推', 2, '10-12'], ['腿彎舉', 2, '10-15'], ['小腿提踵', 3, '12-15'], ['棒式', 3, '30-45']] },
  U2: { name: '上肢 2', ex: [['上斜啞鈴臥推', 3, '8-12'], ['啞鈴單臂划船', 3, '8-12'], ['機械肩推', 3, '10-12'], ['臉拉', 3, '12-15'], ['側平舉', 3, '12-15'], ['捲腹', 3, '12-15']] },
  L2: { name: '下肢 2', ex: [['臀推', 3, '8-12'], ['保加利亞分腿蹲', 3, '8-12'], ['腿伸展', 2, '12-15'], ['腿彎舉', 2, '12-15'], ['髖外展機', 2, '12-15'], ['懸吊抬腿', 3, '10-12']] },
};
const ROTATION = { 1: ['A'], 2: ['A', 'B'], 3: ['A', 'B'], 4: ['U1', 'L1', 'U2', 'L2'], 5: ['U1', 'L1', 'U2', 'L2'], 6: ['U1', 'L1', 'U2', 'L2'] };
function customTpls() { return recs('tpl').map(r => ({ key: r.id, name: r.data.name, ex: r.data.ex || [], uid: r.uid })).sort((a, b) => a.name.localeCompare(b.name)); }
function getTpl(k) { if (!k) return null; if (TPL[k]) return TPL[k]; const r = S.records[k]; return r && !r.deleted && r.type === 'tpl' ? { name: r.data.name, ex: r.data.ex || [] } : null; }
function tplRange(tplKey, exName) {
  const t = getTpl(tplKey); const e = t && t.ex.find(x => x[0] === exName);
  const m = (e ? e[2] : '8-12').split('-').map(Number); return [m[0] || 8, m[1] || m[0] || 12];
}
const CARDIO = { treadmill: '跑步機', bike: '飛輪/腳踏車', elliptical: '橢圓機', stair: '爬梯機', walk: '戶外快走', run: '戶外跑步', swim: '游泳', other: '其他' };
const MET = { bike: 6.8, elliptical: 5.0, stair: 8.8, walk: 4.3, swim: 6.0, other: 5.0 };

/* ---------- 每日（量測＋打卡） ---------- */
function daily(uid, date) { const r = S.records['d_' + uid + '_' + date]; return r && !r.deleted ? r.data || {} : {}; }
function saveDaily(uid, date, patch) {
  const id = 'd_' + uid + '_' + date; const old = S.records[id] && !S.records[id].deleted ? S.records[id].data : {};
  put({ id, uid, type: 'daily', date, data: Object.assign({}, old, patch) });
}
function weights(uid) {
  return recs('daily', uid).filter(r => r.data && num(r.data.weight) > 0)
    .map(r => ({ date: r.date, x: dayNum(r.date), y: num(r.data.weight) })).sort((a, b) => a.x - b.x);
}
function trendWeight(uid, asOf = todayStr(), excludeAsOf = false) {
  const ws = weights(uid); const end = dayNum(asOf) - (excludeAsOf ? 1 : 0);
  const win = ws.filter(w => w.x <= end && w.x > end - 7);
  if (win.length) return avg(win.map(w => w.y));
  const prev = ws.filter(w => w.x <= end); if (prev.length) return prev[prev.length - 1].y;
  return num(profile(uid).startWeight) || 60;
}
function trendSeries(uid) {
  const ws = weights(uid);
  return ws.map(w => ({ x: w.x, y: avg(ws.filter(v => v.x <= w.x && v.x > w.x - 7).map(v => v.y)) }));
}
function weeklyRate(uid) {
  const end = dayNum(todayStr()); const ws = weights(uid).filter(w => w.x > end - 21);
  if (ws.length < 4 || ws[ws.length - 1].x - ws[0].x < 7) return null;
  return linreg(ws) * 7;
}
function lastWeighIn(uid) { const ws = weights(uid); return ws.length ? ws[ws.length - 1] : null; }
function latestOf(uid, key) { const rs = recs('daily', uid).filter(r => num(r.data[key]) > 0).sort((a, b) => b.date.localeCompare(a.date)); return rs.length ? { v: num(rs[0].data[key]), date: rs[0].date } : null; }
function firstOfRange(uid, key, from, to) { const rs = recs('daily', uid).filter(r => r.date >= from && r.date <= to && num(r.data[key]) > 0).sort((a, b) => a.date.localeCompare(b.date)); return rs.length ? { first: num(rs[0].data[key]), last: num(rs[rs.length - 1].data[key]), n: rs.length } : null; }
function waterTarget(uid) { return Math.round(trendWeight(uid) * 33 / 100) * 100; }

/* ---------- 熱量目標 ---------- */
function targets(uid) {
  const p = profile(uid); const w = trendWeight(uid); const h = num(p.height) || 160; const notes = [];
  const bmr = 10 * w + 6.25 * h - 5 * age(p) + (p.sex === 'M' ? 5 : -161);
  const trainAllow = clamp(num(p.trainDays), 0, 7) * 300 / 7;
  const est = bmr * num(p.life || 1.35) + trainAllow;
  const tdee = num(p.tdeeOverride) > 0 ? num(p.tdeeOverride) : est;
  const toGoal = w - num(p.goalWeight);
  let deficit = 0;
  if (toGoal > 0.3) deficit = num(p.pace) * 7700 / 7;
  else if (toGoal < -0.3) { deficit = -200; notes.push('目標體重高於目前：小幅熱量盈餘（+200）配合重訓增肌'); }
  else notes.push('已在目標附近：熱量設為維持');
  if (deficit > tdee * 0.25) { deficit = tdee * 0.25; notes.push('赤字限制在 TDEE 的 25% 以內，避免掉肌肉'); }
  let kcal = tdee - deficit;
  const floor = Math.max(p.sex === 'M' ? 1500 : 1200, bmr);
  if (deficit > 0 && kcal < floor) { kcal = floor; notes.push('熱量不低於基礎代謝（' + r0(floor) + '）'); }
  const refW = Math.min(w, 25 * (h / 100) ** 2);
  const pr = 1.8 * refW, fat = Math.max(0.7 * refW, kcal * 0.25 / 9), carb = Math.max(50, (kcal - pr * 4 - fat * 9) / 4);
  return { bmr, est, tdee, trainAllow, deficit, kcal: Math.round(kcal / 10) * 10, p: r0(pr), f: r0(fat), c: r0(carb), fib: r0(Math.max(20, kcal / 1000 * 14)), na: 2300, water: waterTarget(uid), w, refW, notes, toGoal };
}
function adaptiveTdee(uid) {
  const t = todayStr(); const start = addDays(t, -28); const days = [];
  for (let d = start; d < t; d = addDays(d, 1)) { const k = sumFood(foodEntries(uid, d)).kcal; if (k >= 800) days.push(k); }
  const ws = weights(uid).filter(w => w.x >= dayNum(start) && w.x < dayNum(t));
  if (days.length < 14 || ws.length < 8 || ws[ws.length - 1].x - ws[0].x < 14) return { ok: false, days: days.length, weighs: ws.length };
  const slope = linreg(ws); const a = avg(days);
  return { ok: true, est: Math.round((a - slope * 7700) / 10) * 10, avg: r0(a), rate: slope * 7, days: days.length, weighs: ws.length };
}

/* ---------- 飲食 ---------- */
function foodEntries(uid, date) { return recs('food', uid, date).sort((a, b) => (a.data.t || 0) - (b.data.t || 0)); }
function sumFood(list) {
  const s = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, na: 0, naKnown: 0, n: list.length };
  list.forEach(r => {
    const d = r.data, q = num(d.qty) || 1;
    s.kcal += num(d.kcal) * q; s.p += num(d.p) * q; s.c += num(d.c) * q; s.f += num(d.f) * q; s.fib += num(d.fib) * q;
    if (d.na !== '' && d.na != null) { s.na += num(d.na) * q; s.naKnown++; }
  });
  return s;
}
const dayFood = (uid, date) => sumFood(foodEntries(uid, date));

/* ---------- 進度 ---------- */
function bmiOf(uid) { const p = profile(uid); const h = num(p.height) / 100; return h ? trendWeight(uid) / (h * h) : 0; }
function fatness(uid) { return clamp((bmiOf(uid) - 18.5) / (33 - 18.5), 0, 1); }
function progressPct(uid) {
  const p = profile(uid); const s = num(p.startWeight), g = num(p.goalWeight), w = trendWeight(uid);
  if (Math.abs(s - g) < 0.1) return 100;
  return clamp((s - w) / (s - g) * 100, 0, 100);
}
// 定稿人物身形：依「目標進度」決定，不用 BMI 絕對值（不評價體型）
function bodyStage(uid) {
  const p = profile(uid); const s = num(p.startWeight), g = num(p.goalWeight), w = trendWeight(uid);
  if (g < s) { if (w >= s * 1.04) return 'round'; if (w >= s * 1.02) return 'soft'; }
  const pct = progressPct(uid);
  return pct >= 100 ? 'lean_toned' : pct >= 50 ? 'fit' : 'neutral';
}
const STAGE_NAMES = { lean_toned: '結實', fit: '勻稱', neutral: '起點', soft: '豐潤', round: '圓潤' };
function baseName(pct) { return pct >= 100 ? '回本壘得分' : pct >= 75 ? '三壘' : pct >= 50 ? '二壘' : pct >= 25 ? '一壘' : '打擊區'; }
function eta(uid) {
  const p = profile(uid); const w = trendWeight(uid); const g = num(p.goalWeight); const diff = w - g;
  if (diff <= 0.2) return { reached: true };
  const rate = weeklyRate(uid); let perWk, basis;
  if (rate != null && rate < -0.05) { perWk = -rate; basis = '依近 3 週實際速度'; } else { perWk = num(p.pace) || 0.5; basis = '依計畫速度'; }
  const weeks = diff / perWk; const d = new Date(); d.setDate(d.getDate() + Math.round(weeks * 7));
  return { reached: false, weeks, date: d, basis, diff };
}
function loggedDay(uid, date) { return foodEntries(uid, date).length > 0; }
function streak(uid) {
  let d = todayStr(); if (!loggedDay(uid, d)) d = addDays(d, -1); let n = 0;
  while (loggedDay(uid, d) && n < 999) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- 訓練 ---------- */
function session(uid, date) { const r = S.records['w_' + uid + '_' + date]; return r && !r.deleted ? r.data : null; }
function saveSession(uid, date, data) { put({ id: 'w_' + uid + '_' + date, uid, type: 'workout', date, data }); }
function sessionsOf(uid) { return recs('workout', uid).sort((a, b) => b.date.localeCompare(a.date)); }
function lastExercise(uid, name, beforeDate) {
  for (const r of sessionsOf(uid)) { if (r.date >= beforeDate) continue; const e = (r.data.exercises || []).find(x => x.name === name); if (e && e.sets.some(s => s.done)) return { date: r.date, ex: e, tpl: r.data.tpl }; }
  return null;
}
function e1rm(kg, reps) { kg = num(kg); reps = num(reps); if (!kg || !reps) return 0; return reps === 1 ? kg : kg * (1 + Math.min(reps, 12) / 30); }
function nextTpl(uid) {
  const rot = ROTATION[clamp(num(profile(uid).trainDays) || 3, 1, 6)];
  const last = sessionsOf(uid).find(r => r.data.tpl && r.date < todayStr());
  if (!last) return rot[0];
  const i = rot.indexOf(last.data.tpl); return rot[(i + 1) % rot.length] || rot[0];
}
function cardioKcal(c, kg) {
  const min = num(c.min); if (!min) return 0;
  if (num(c.kcalManual) > 0) return num(c.kcalManual);
  if (c.kind === 'treadmill' || ((c.kind === 'run' || c.kind === 'walk') && num(c.speed) > 0)) {
    const v = num(c.speed) * 1000 / 60, g = num(c.incline) / 100;
    const vo2 = num(c.speed) <= 6.5 ? 0.1 * v + 1.8 * v * g : 0.2 * v + 0.9 * v * g;
    return vo2 * kg / 1000 * 5 * min;
  }
  return ((MET[c.kind] || 5) - 1) * 3.5 * kg / 200 * min;
}
function sessionStats(uid, date) {
  const s = session(uid, date); const kg = trendWeight(uid);
  const out = { sets: 0, vol: 0, exN: 0, cardioMin: 0, cardioKcal: 0, steps: num(daily(uid, date).steps), legs: false, parts: [] };
  if (!s) return out;
  (s.exercises || []).forEach(e => {
    const d = e.sets.filter(x => x.done); if (d.length) { out.exN++; const pt = exPart(e.name); if (pt && !out.parts.includes(pt)) out.parts.push(pt); if (pt === '腿' || pt === '臀/後側') out.legs = true; }
    out.sets += d.length; d.forEach(x => { if (exUnit(e.name) !== 'sec') out.vol += num(x.kg) * num(x.reps); });
  });
  (s.cardio || []).forEach(c => { out.cardioMin += num(c.min); out.cardioKcal += cardioKcal(c, kg); });
  return out;
}
const trained = st => st.sets >= 6 || st.cardioMin >= 20;
function newExerciseOn(uid, date) {
  const s = session(uid, date); if (!s) return false;
  return (s.exercises || []).some(e => e.sets.some(x => x.done) && !lastExercise(uid, e.name, date));
}

/* ---------- 經期 ---------- */
function cycles(uid) { return recs('cycle', uid).map(r => Object.assign({ id: r.id }, r.data)).filter(c => c.start).sort((a, b) => a.start.localeCompare(b.start)); }
function cycleLen(uid) {
  const cs = cycles(uid); const p = profile(uid);
  const diffs = []; for (let i = 1; i < cs.length; i++) { const d = dayNum(cs[i].start) - dayNum(cs[i - 1].start); if (d >= 18 && d <= 45) diffs.push(d); }
  const recent = diffs.slice(-6);
  return recent.length ? clamp(Math.round(avg(recent)), 21, 40) : clamp(num(p.cycleLen) || 28, 21, 40);
}
function cyclePhase(uid, date = todayStr()) {
  const cs = cycles(uid).filter(c => c.start <= date); if (!cs.length) return null;
  const last = cs[cs.length - 1]; const p = profile(uid); const L = cycleLen(uid);
  const day = dayNum(date) - dayNum(last.start) + 1;
  const next = addDays(last.start, L); const toNext = dayNum(next) - dayNum(date);
  const inPeriod = last.end ? date <= last.end : day <= (num(p.periodLen) || 5);
  let phase;
  if (inPeriod) phase = '經期';
  else if (day > L + 10) phase = '未知';
  else if (toNext <= 0) phase = '可能延遲';
  else if (toNext <= 7) phase = '經前';
  else if (Math.abs(day - (L - 14)) <= 1) phase = '排卵期';
  else if (day > L - 14) phase = '黃體期';
  else phase = '濾泡期';
  return { phase, day, next, toNext, inPeriod, L, last };
}
const PHASE_NOTE = {
  '經期': '前 2～3 天體重可能偏高，之後會回落。食慾較大是正常的，優先吃足蛋白質和蔬菜。',
  '濾泡期': '這段通常體力最好、水分最少，適合挑戰重量。',
  '排卵期': '體重可能小幅波動。',
  '黃體期': '代謝略高、食慾變大，留住水分的情況會逐漸增加。',
  '經前': '經前一週常留住水分（+0.5～2 kg），體重上升多半不是脂肪。想吃甜時，先吃一份蛋白質和水果。',
  '可能延遲': '已超過預估日期。壓力、睡眠、大幅減重都可能影響週期。',
  '未知': '距離上次記錄太久，請記錄這次經期開始日。',
};

/* ---------- 體重波動解讀 ---------- */
function baselineNa(uid, date) {
  const vals = []; for (let i = 2; i <= 8; i++) { const s = dayFood(uid, addDays(date, -i)); if (s.naKnown >= 1 && s.kcal >= 800) vals.push(s.na); }
  return vals.length >= 3 ? avg(vals) : 2500;
}
function baselineCarb(uid, date) {
  const vals = []; for (let i = 2; i <= 8; i++) { const s = dayFood(uid, addDays(date, -i)); if (s.kcal >= 800) vals.push(s.c); }
  return vals.length >= 3 ? avg(vals) : null;
}
function explainWeight(uid, date = todayStr()) {
  const dd = daily(uid, date); const w = num(dd.weight); if (!w) return null;
  const trendPrev = trendWeight(uid, date, true); const ws = weights(uid).filter(x => x.date < date);
  if (!ws.length) return { first: true, w, headline: '第一筆體重已記錄。之後每天量，就能看出趨勢和原因。', causes: [], question: null };
  const y = addDays(date, -1), y2 = addDays(date, -2);
  const delta = w - trendPrev; const up = delta > 0;
  const prevW = ws[ws.length - 1];
  const fy = dayFood(uid, y); const t = targets(uid); const p = profile(uid);
  const causes = []; const ans = dd.answers || {};
  const add = (text, score, dir = 'up') => causes.push({ text, score, dir });
  // 量測條件
  if (dd.weighTime && dd.weighTime > '11:00') add(`今天 ${dd.weighTime} 才量，比早上空腹多了食物和水分（約 +0.3～1 kg）。`, 2);
  if (dd.bowel === 'no') add('早上還沒排便（約 +0.2～0.5 kg）。', 1);
  if (dd.bowel === 'yes' && !up) add('早上有排便，腸道內容物較少。', 1, 'down');
  // 鈉
  const fy2 = dayFood(uid, y2); const naBase = baselineNa(uid, date);
  if (fy.naKnown >= 1 && fy.na > Math.max(naBase + 1000, 3200)) add(`昨天鈉約 ${r0(fy.na / 100) * 100} mg，比平常（約 ${r0(naBase / 100) * 100}）高，身體會暫時多留水（約 +0.3～1.5 kg，通常 2～3 天退）。`, 3);
  else if (fy2.naKnown >= 1 && fy2.na > Math.max(naBase + 1500, 3800)) add(`前天鈉偏高（約 ${r0(fy2.na / 100) * 100} mg），水分可能還沒完全退。`, 1.5);
  else if (fy.naKnown >= 2 && !up && fy.na < naBase - 800) add('昨天吃得比平常清淡，鈉少、水分跟著減少。', 1.5, 'down');
  if (ans.salty === 'yes') add('你回答昨天有吃比較鹹或沒記到的外食，水分滯留機率高。', 2.5);
  // 碳水
  const cBase = baselineCarb(uid, date);
  if (cBase != null && fy.kcal >= 800) {
    const dc = fy.c - cBase;
    if (dc > 60) add(`昨天碳水約 ${r0(fy.c)} g，比平常多 ${r0(dc)} g；每 1 g 肝醣會帶約 3 g 水（約 +${r1(Math.min(dc * 4 / 1000, 1.5))} kg）。`, 2.2);
    else if (dc < -60 && !up) add(`昨天碳水比平常少 ${r0(-dc)} g，肝醣和水分減少，這部分不是脂肪。`, 2, 'down');
  }
  // 吃多少 → 真正的脂肪
  if (fy.kcal > t.kcal + 300) add(`昨天多吃約 ${r0(fy.kcal - t.kcal)} kcal，換算真正的脂肪只有約 ${r0((fy.kcal - t.kcal) / 7700 * 1000)} g，其餘是食物重量和水分。`, 1.2);
  // 訓練
  const sty = sessionStats(uid, y), sty2 = sessionStats(uid, y2);
  if (sty.legs || sty2.legs) add(`${sty.legs ? '昨天' : '前天'}練了下肢，肌肉修復期會留住水分（約 +0.3～1 kg，2～4 天）。`, 2);
  else if (newExerciseOn(uid, y)) add('昨天做了新動作，肌肉修復會暫時留住水分。', 1.5);
  // 經期
  if (p.sex === 'F') {
    const ph = cyclePhase(uid, date);
    if (ph && (ph.phase === '經前' || (ph.phase === '經期' && ph.day <= 3))) add(`${ph.phase === '經前' ? `距離預估經期約 ${ph.toNext} 天，經前常留住水分` : `經期第 ${ph.day} 天，水分還沒退`}（約 +0.5～2 kg）。`, 3);
    else if (ph && ph.phase === '經期' && ph.day > 3 && !up) add('經期後段，前幾天留住的水分正在退。', 2, 'down');
    else if (ph && ph.phase === '濾泡期' && ph.day <= 10 && !up) add('經期剛結束，水分回落。', 1.5, 'down');
    if (ans.period === 'soon') add('你回答經期快到了，經前水分滯留很常見。', 2.5);
  }
  // 睡眠、壓力、酒
  if (dd.sleep === 'bad') add('昨晚睡不好，壓力荷爾蒙會讓身體多留水。', 1.2);
  if (dd.stress === 'high') add('最近壓力大，也會讓體重偏高、波動變大。', 1);
  if (dd.alcohol) add(up ? '昨晚有喝酒，通常隔天先脫水、之後 1～2 天回升。' : '昨晚喝酒造成暫時脫水，數字偏低，之後會回來。', 1.5, up ? 'up' : 'down');
  const water = num(daily(uid, y).waterMl);
  if (water && water < t.water * 0.5) add('昨天喝水偏少，身體反而容易留水。', 0.8);

  const rel = causes.filter(c => c.dir === (up ? 'up' : 'down')).sort((a, b) => b.score - a.score);
  const ad = Math.abs(delta);
  const rate = weeklyRate(uid);
  const trendTxt = rate == null ? '' : rate < -0.05 ? '7 日平均仍在下降' : rate > 0.05 ? '7 日平均近期在上升' : '7 日平均大致持平';
  let headline, question = null;
  if (ad < 0.4) headline = `今天 ${r1(w)} kg，和最近平均只差 ${r1(delta) > 0 ? '+' : ''}${r1(delta)} kg，在正常每日波動內。${trendTxt ? trendTxt + '。' : ''}`;
  else if (up) {
    headline = `今天比最近平均高 ${r1(delta)} kg。` + (rel.length ? '最可能的原因：' : '');
    if (!rel.length) {
      if (!dd.checkin) question = { key: 'checkin', text: '我還找不到明顯原因。先完成今天的晨間打卡（睡眠、排便、壓力），我再判斷一次？', options: [] };
      else if (p.sex === 'F' && !ans.period && !cycles(uid).length) question = { key: 'period', text: '經期快到了嗎？', options: [['soon', '快到了'], ['no', '還沒'], ['in', '正在經期']] };
      else if (!ans.salty) question = { key: 'salty', text: '昨天有吃比較鹹、或沒記到的外食嗎？', options: [['yes', '有'], ['no', '沒有']] };
      else headline += '目前資料裡找不到明顯原因。單日上升 1 kg 以內多半是水分，先看接下來 3 天的趨勢。';
    }
  } else {
    headline = `今天比最近平均低 ${r1(-delta)} kg。` + (rel.length ? '可能的原因：' : (rate != null && rate < -0.05 ? '和趨勢一致，持續在變瘦。' : '可能是水分偏低，先看接下來幾天是否維持。'));
  }
  const dayJump = prevW && prevW.date === y ? w - prevW.y : null;
  return { w, delta, dayJump, up, headline, causes: ad < 0.4 ? [] : rel.slice(0, 3), question, trendTxt };
}

/* ---------- 建議（短、理性） ---------- */
function adviceFor(uid) {
  const t = targets(uid); const today = todayStr(); const ents = foodEntries(uid, today); const s = sumFood(ents);
  const hr = new Date().getHours(); const L = []; const dd = daily(uid, today);
  if (dd.gameDay) L.push('看球日：白天的餐點以蛋白質和蔬菜為主，留約 600 kcal 給球場。球場食物普遍很鹹，明天體重偏高是正常的。');
  if (!ents.length) {
    L.push(hr < 11 ? '今天還沒有記錄。早餐放一份蛋白質（蛋、無糖豆漿、優格）會比較容易達標。' : '今天還沒有飲食記錄。先把已吃的補上，越晚補越容易估不準。');
  } else {
    const remK = t.kcal - s.kcal, remP = t.p - s.p;
    if (remK < -150) L.push(`今天已超過目標 ${r0(-remK)} kcal。不用補償性少吃，明天照原計畫就好，單日超出對趨勢影響很小。`);
    if (remP > 20) {
      const budget = Math.max(remK, 160);
      const picks = PROTEIN_PICKS.map(n => BUILTIN_FOODS.find(f => f.name === n)).filter(f => f && f.kcal <= budget).sort((a, b) => b.p / b.kcal - a.p / a.kcal).slice(0, 2);
      L.push(`蛋白質還差 ${r0(remP)} g` + (picks.length ? `，例如：${picks.map(f => `${f.name} ${f.unit}（${f.p}g）`).join('、')}。` : '。'));
    } else if (remP <= 0 && L.length < 2) L.push('蛋白質已達標。');
    if (s.kcal > 600 && s.f * 9 / s.kcal > 0.4) L.push(`脂肪占今日熱量 ${r0(s.f * 9 / s.kcal * 100)}%，下一餐優先選清蒸、水煮、滷（去皮去肥）。`);
    if (s.naKnown >= 2 && s.na > 3000) L.push(`今天鈉已約 ${r0(s.na / 100) * 100} mg，下一餐少湯少醬、多喝水，明天體重偏高也別緊張。`);
    if (hr >= 19 && remK > t.kcal * 0.55) L.push('剩餘熱量還很多。若是漏記記得補；若真的吃得少，晚餐正常吃，長期吃太少容易掉肌肉。');
    if (hr >= 18 && ents.length >= 2 && s.fib < t.fib * 0.4) L.push('今天蔬菜偏少，晚餐加一份燙青菜或沙拉。');
  }
  if (hr >= 15 && num(dd.waterMl) < t.water * 0.4) L.push(`今天喝水約 ${r0(num(dd.waterMl))} ml，目標 ${t.water} ml。`);
  const rate = weeklyRate(uid);
  if (rate != null && t.toGoal > 0.3) {
    const pct = -rate / t.w * 100;
    if (pct > 1.0) L.push(`近 3 週每週下降約 ${r1(-rate)} kg（${r1(pct)}%），偏快。建議每天多吃約 150 kcal，以保留肌肉。`);
    else if (rate > -0.05 && weekStats(uid).logged >= 6) L.push('近 3 週體重持平。先確認記錄完整（醬料、飲料），再考慮每天少 150 kcal 或多走 2000 步。');
  }
  return L.slice(0, 3);
}

/* ---------- 週統計、週回顧、月報 ---------- */
function weekStats(uid, end = todayStr()) {
  const tg = targets(uid); let pDays = 0, kDays = 0, train = 0, logged = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(end, -i); const s = dayFood(uid, d);
    if (s.kcal > 0) { logged++; if (s.p >= tg.p * 0.9) pDays++; if (Math.abs(s.kcal - tg.kcal) <= tg.kcal * 0.1) kDays++; }
    if (trained(sessionStats(uid, d))) train++;
  }
  return { pDays, kDays, train, logged, plan: num(profile(uid).trainDays) };
}
function battingAvg(uid) { const w = weekStats(uid); return { hits: w.pDays, ab: 7, txt: (w.pDays / 7).toFixed(3).replace(/^0/, '') }; }
function weekReview(uid, end) {
  const tg = targets(uid); const days = rangeDays(addDays(end, -6), end);
  const food = days.map(d => dayFood(uid, d)); const logged = food.filter(f => f.kcal >= 500);
  const ws = weekStats(uid, end);
  const sleepBad = days.filter(d => daily(uid, d).sleep === 'bad').length;
  const steps = days.map(d => num(daily(uid, d).steps)).filter(Boolean);
  const tStart = trendWeight(uid, addDays(end, -7)), tEnd = trendWeight(uid, end);
  const hasW = weights(uid).some(w => w.date >= addDays(end, -13) && w.date <= end);
  const expected = logged.length ? logged.reduce((a, f) => a + (tg.tdee - f.kcal), 0) / logged.length * 7 / 7700 : null;
  let focus;
  if (logged.length < 5) focus = '下週先把「每天都記錄」做到，就算不完美也比空白好。';
  else if (ws.pDays < 4) focus = `下週專注蛋白質：每餐先放一份蛋白質，目標每天 ${tg.p} g。`;
  else if (ws.train < ws.plan) focus = `下週把重訓排進行事曆，目標 ${ws.plan} 次。`;
  else if (avg(logged.map(f => f.kcal)) > tg.kcal * 1.1) focus = `平均熱量超過目標約 ${r0(avg(logged.map(f => f.kcal)) - tg.kcal)} kcal，下週先從飲料和點心調整。`;
  else if (sleepBad >= 3) focus = '這週睡不好的天數偏多，下週優先睡滿 7 小時，對食慾和恢復都有幫助。';
  else focus = '這週做得很穩，下週維持同樣的節奏即可。';
  return {
    days: days.length, logged: logged.length, avgKcal: r0(avg(logged.map(f => f.kcal))), avgP: r0(avg(logged.map(f => f.p))),
    pDays: ws.pDays, kDays: ws.kDays, train: ws.train, plan: ws.plan, sleepBad, avgSteps: r0(avg(steps)),
    change: hasW ? tEnd - tStart : null, expected, focus, tg,
  };
}
function monthReport(uid, ym) {
  const [Y, M] = ym.split('-').map(Number); const from = ym + '-01';
  let to = todayStr(new Date(Y, M, 0)); if (to > todayStr()) to = todayStr();
  if (from > to) return null;
  const days = rangeDays(from, to); const tg = targets(uid);
  const food = days.map(d => dayFood(uid, d)).filter(f => f.kcal >= 500);
  const wsr = weights(uid).filter(w => w.date >= from && w.date <= to);
  const firstW = wsr.length ? avg(wsr.slice(0, 3).map(w => w.y)) : null, lastW = wsr.length ? avg(wsr.slice(-3).map(w => w.y)) : null;
  const sess = sessionsOf(uid).filter(r => r.date >= from && r.date <= to);
  const trainN = days.filter(d => trained(sessionStats(uid, d))).length;
  const cardio = days.reduce((a, d) => a + sessionStats(uid, d).cardioMin, 0);
  const lifts = {};
  sess.slice().reverse().forEach(r => (r.data.exercises || []).forEach(e => {
    if (exUnit(e.name) === 'sec') return; const best = Math.max(0, ...e.sets.filter(x => x.done).map(x => e1rm(x.kg, x.reps))); if (!best) return;
    if (!lifts[e.name]) lifts[e.name] = { first: best, last: best, n: 0 }; lifts[e.name].last = best; lifts[e.name].n++;
  }));
  const liftList = Object.entries(lifts).filter(([, v]) => v.n >= 2).map(([k, v]) => ({ name: k, first: v.first, last: v.last, gain: v.last - v.first })).sort((a, b) => b.gain - a.gain).slice(0, 3);
  const photos = recs('photo', uid).filter(r => r.date >= from && r.date <= to).sort((a, b) => a.date.localeCompare(b.date));
  return {
    from, to, loggedDays: food.length, totalDays: days.length, avgKcal: r0(avg(food.map(f => f.kcal))), avgP: r0(avg(food.map(f => f.p))),
    pHit: food.filter(f => f.p >= tg.p * 0.9).length, firstW, lastW, nW: wsr.length,
    waist: firstOfRange(uid, 'waist', from, to), bf: firstOfRange(uid, 'bf', from, to), muscle: firstOfRange(uid, 'muscle', from, to),
    trainN, cardio, lifts: liftList, photos, tg,
  };
}
function coupleWeek() {
  const a = weekStats('A'), b = weekStats('B');
  return { pHits: a.pDays + b.pDays, pGoal: 10, train: a.train + b.train, trainGoal: a.plan + b.plan };
}

/* ---------- 通知中心（全部在 App 內，不靠 LINE） ----------
   kind：msg＝對方的應援、對方動態、週回顧等（看過就算已讀）
         todo＝今天還沒做的事（做完就自動消失）
         info＝狀態提醒（同步、經期）                                   */
function lastBodyScan(uid) {
  let last = '';
  Object.values(S.records).forEach(r => { if (r.type === 'daily' && r.uid === uid && !r.deleted && r.data && num(r.data.bf) > 0 && r.date > last) last = r.date; });
  return last;
}
function notifications(uid = me()) {
  const out = []; if (!uid || !hasProfile(uid)) return out;
  const t = todayStr(), now = new Date(), hr = now.getHours(), o = otherUid(uid), oName = nameOf(o), p = profile(uid);
  const add = (id, kind, ic, title, body, act, v, sort) => out.push({ id, kind, ic, title, body, act, v, sort: sort || 0 });
  // 1. 對方的應援（7 天內）
  recs('cheer').filter(r => r.data.to === uid && r.date >= addDays(t, -6)).forEach(r =>
    add('cheer:' + r.id, 'msg', 'cheer', `${nameOf(r.uid)} 給你應援`, r.data.msg, 'tab', 'home', r.updatedAt || 0));
  // 2. 對方今天／昨天完成訓練
  if (hasProfile(o)) [t, addDays(t, -1)].forEach((d, i) => {
    if (trained(sessionStats(o, d))) add('ptrain:' + d, 'msg', 'gym', `${oName}${i ? '昨天' : '今天'}完成訓練`, '給個應援吧。', 'cheer', '', dayNum(d) * 1e5);
  });
  // 3. 週回顧（週日晚上～週一）、月報（每月 1～3 日）
  const wd = now.getDay();
  if ((wd === 0 && hr >= 18) || wd === 1) { const end = wd === 0 ? t : addDays(t, -1); add('week:' + end, 'msg', 'home', '本週回顧出爐了', '到總覽看「下週只做一件事」。', 'tab', 'home', dayNum(end) * 1e5 + 1); }
  if (now.getDate() <= 3) { const ym = addDays(t, -now.getDate()).slice(0, 7); add('month:' + ym, 'msg', 'body', `${+ym.slice(5)} 月的月報出爐了`, '到「身體」看這個月的變化。', 'tab', 'body', dayNum(t) * 1e5); }
  // 4. 今天還沒做的事（個人資料可關閉）
  if (p.remind !== false) {
    if (hr >= 5 && !(num(daily(uid, t).weight) > 0)) add('w:' + t, 'todo', 'scale', '今天還沒量體重', '起床、上完廁所後量一次；量完關掉 bpt care 就會自動同步。', 'tab', 'home');
    const nf = recs('food', uid, t).length;
    if (hr >= 20 && nf < 2) add('food:' + t, 'todo', 'food', nf ? '今天的飲食只記了 1 筆' : '今天還沒有飲食記錄', '睡前補一下，明天的體重解讀才會準。', 'tab', 'food');
    const ls = lastBodyScan(uid);
    if (!ls || dayNum(t) - dayNum(ls) >= 30) add('scan:' + t.slice(0, 7), 'todo', 'body', ls ? `完整體組成報告已經 ${dayNum(t) - dayNum(ls)} 天沒更新` : '還沒有完整體組成報告', '一個月傳一次 bpt care 的完整報告截圖就夠了。', 'tab', 'body');
  }
  // 5. 經期快到了（兩人都看得到）
  UIDS.forEach(u => {
    if (!hasProfile(u) || profile(u).sex !== 'F') return; const c = cyclePhase(u); if (!c || c.inPeriod) return;
    if (c.toNext >= 0 && c.toNext <= 3) add('cyc:' + u + ':' + c.next, 'info', 'drop', `${u === uid ? '你' : nameOf(u)}的經期預計${c.toNext ? ' ' + c.toNext + ' 天後' : '今天'}開始`, '這幾天體重偏高多半是水分，不用緊張。', 'tab', 'body');
  });
  // 6. 同步狀態
  if (S.cfg.apiUrl && S.syncErr) add('sync:' + t, 'info', 'set', '雲端同步失敗', String(S.syncErr).slice(0, 80) + '。點這裡重試。', 'syncNow', '');
  else if (S.cfg.apiUrl && S.pending.length && Date.now() - (S.lastSyncAt || 0) > 6 * 3600e3) add('pend:' + t, 'info', 'set', `有 ${S.pending.length} 筆資料還沒上傳`, '點這裡立即同步。', 'syncNow', '');
  const rank = { todo: 0, info: 1, msg: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.sort - a.sort);
}
function unseenCount(uid = me()) { const seen = S.cfg.seen || {}; return notifications(uid).filter(n => !seen[n.id]).length; }
function markNotifSeen(uid = me()) {
  const seen = S.cfg.seen || (S.cfg.seen = {}); const now = Date.now();
  notifications(uid).forEach(n => { if (!seen[n.id]) seen[n.id] = now; });
  Object.keys(seen).forEach(k => { if (now - seen[k] > 40 * 864e5) delete seen[k]; });  // 只留 40 天
}

/* ---------- 人物表情 ---------- */
function exprFor(uid) {
  const p = profile(uid); if (p.avatar.expr && p.avatar.expr !== 'auto') return normExpr(p.avatar.expr);
  const t = todayStr(); const dd = daily(uid, t);
  if (dd.sleep === 'bad') return 'sleepy';
  const st = sessionStats(uid, t); if (trained(st)) return 'proud';
  const s = dayFood(uid, t); const tg = targets(uid);
  if (s.n && s.p >= tg.p * 0.9 && s.kcal <= tg.kcal * 1.05) return 'laugh';
  return 'calm';
}
