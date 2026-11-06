'use strict';
/* =========================================================
   兩人減脂 v2 — 同步、事件、啟動
   ========================================================= */
function toast(msg, ms = 2200) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/* ---------- API / 同步 ---------- */
async function api(action, payload = {}, timeout = 30000) {
  if (!S.cfg.apiUrl) throw new Error('尚未設定雲端網址');
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), timeout);
  let res;
  try { res = await fetch(S.cfg.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action, token: S.cfg.token }, payload)), signal: ctl.signal, redirect: 'follow' }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? '連線逾時，請再試一次' : '連不到雲端（請檢查網路或網址）'); }
  finally { clearTimeout(tm); }
  let j; try { j = await res.json(); } catch (e) { throw new Error('雲端回應格式錯誤：請確認部署時「誰可以存取」選「所有人」，且網址結尾是 /exec'); }
  if (!j.ok) throw new Error(j.error || '雲端錯誤');
  return j;
}
let syncing = false, syncTimer = null;
function queueSync(ms = 1500) { if (!S.cfg.apiUrl) { setSyncUI(); return; } clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, ms); setSyncUI(); }
async function syncNow() {
  if (!S.cfg.apiUrl || syncing) return; syncing = true; setSyncUI();
  try {
    while (S.pending.length) {
      const ids = S.pending.slice(0, 200); const batch = ids.map(id => S.records[id]).filter(Boolean);
      const sent = {}; batch.forEach(r => { sent[r.id] = r.updatedAt; });
      await api('push', { records: batch });
      S.pending = S.pending.filter(id => !(id in sent) || (S.records[id] && S.records[id].updatedAt !== sent[id]));
      persist(); if (ids.every(id => S.pending.includes(id))) break;
    }
    const j = await api('pull', { since: S.lastTs });
    let changed = false;
    (j.records || []).forEach(r => {
      const loc = S.records[r.id];
      if (!loc || (num(r.updatedAt) >= num(loc.updatedAt) && !S.pending.includes(r.id))) {
        if (!loc || loc.updatedAt !== r.updatedAt || !!loc.deleted !== !!r.deleted || JSON.stringify(loc.data) !== JSON.stringify(r.data)) changed = true;
        S.records[r.id] = r;
      }
    });
    S.lastTs = Math.max(S.lastTs, num(j.maxTs)); S.lastSyncAt = Date.now(); S.syncErr = ''; persist();
    if (changed) safeRender();
  } catch (e) { S.syncErr = e.message || String(e); persist(); }
  finally { syncing = false; setSyncUI(); }
}
function setSyncUI() {
  const dot = $('#syncDot'), tx = $('#syncTxt'); if (!dot) return;
  dot.className = 'dot';
  if (!S.cfg.apiUrl) { tx.textContent = '僅本機'; return; }
  if (syncing) { dot.classList.add('pend'); tx.textContent = '同步中'; return; }
  if (S.syncErr) { dot.classList.add('err'); tx.textContent = '同步失敗'; return; }
  if (S.pending.length) { dot.classList.add('pend'); tx.textContent = '待上傳 ' + S.pending.length; return; }
  dot.classList.add('ok'); tx.textContent = '已同步';
}
function isEditing() { const a = document.activeElement; return UI.sheetOpen || (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)); }
function safeRender() { if (isEditing()) UI.needRender = true; else render(); }
setInterval(() => { if (document.visibilityState === 'visible' && S.cfg.apiUrl) syncNow(); }, 45000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncNow(); safeRender(); } });
window.addEventListener('online', () => syncNow());

/* ---------- Sheet ---------- */
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.remove('hidden'); UI.sheetOpen = true; }
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheetBody').innerHTML = ''; UI.sheetOpen = false; UI.ai = null; if (UI.needRender) { UI.needRender = false; render(); } }

/* ---------- Render ---------- */
const TABS = [['home', '總覽'], ['food', '飲食'], ['gym', '運動'], ['body', '身體'], ['set', '設定']];
function setBell() {
  const b = $('#bellBtn'); if (!b) return;
  let n = 0; try { n = unseenCount(); } catch (e) { console.error(e); }
  b.style.display = hasProfile(me()) ? '' : 'none';
  b.innerHTML = icon('bell') + (n ? `<span class="badge">${n > 9 ? '9+' : n}</span>` : '');
}
function render() {
  const A = nameOf('A'), B = nameOf('B');
  $('#title').innerHTML = `${esc(A)} <span class="amp">&amp;</span> ${esc(B)}`; document.title = `${A} & ${B}｜減脂 \\Fight/`;
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="${UI.tab === k ? 'on' : ''}" data-act="tab" data-tab="${k}">${icon(k)}${l}</button>`).join('');
  const fn = { home: viewHome, food: viewFood, gym: viewGym, body: viewBody, set: viewSet }[UI.tab];
  let html; try { html = fn(); } catch (e) { console.error(e); html = `<div class="card"><b>畫面發生錯誤</b><div class="small muted">${esc(e.message)}</div><div class="tiny muted mt8">請截圖給開發者。資料不會遺失。</div></div>`; }
  $('#main').innerHTML = html; setSyncUI(); setBell();
  if (UI.tab === 'set') refreshPreview();
  if (UI.tab === 'body') { const f = $('#phFile'); if (f) f.addEventListener('change', onPhotoFile); if ($('#cmpBox')) loadCompare(); }
}

/* ---------- 共用動作 ---------- */
function foodRec(data, date, uid) { uid = uid || me(); return { id: newId('f_' + uid), uid, type: 'food', date: date || UI.fdate, data: Object.assign({ t: Date.now() }, data) }; }
function saveFoodItems(items, meal, split) {
  const gid = split ? newId('g') : '';
  items.forEach((d, i) => {
    const base = Object.assign({}, d, { meal, t: Date.now() + i });
    if (split) {
      const q = num(d.qty) || 1;
      put(foodRec(Object.assign({}, base, { qty: r1(q * split * 100) / 100, gid, by: me() })));
      put(foodRec(Object.assign({}, base, { qty: r1(q * (1 - split) * 100) / 100, gid, by: me() }), UI.fdate, otherUid(me())));
    } else put(foodRec(base));
  });
}
function saveLib(d) { put({ id: newId('lib'), uid: me(), type: 'foodlib', date: '', data: { name: d.name, unit: d.unit, kcal: d.kcal, p: d.p, c: d.c, f: d.f, fib: d.fib, na: d.na } }); }
function startTpl(k) {
  const u = me(), d = UI.wdate; const t = getTpl(k); if (!t) return;
  const exercises = t.ex.map(([name, sets]) => {
    const last = lastExercise(u, name, d); const ls = last ? last.ex.sets.filter(x => x.done) : [];
    return { name, sets: Array.from({ length: sets }, (_, i) => ({ kg: ls[i] ? ls[i].kg : (ls[0] ? ls[0].kg : ''), reps: '', done: false })) };
  });
  const old = session(u, d) || {}; saveSession(u, d, Object.assign({}, old, { tpl: k, exercises, cardio: old.cardio || [], finished: false })); render();
}
function swapTpl(k) {
  const u = me(), d = UI.wdate; const t = getTpl(k); if (!t) return; const s = curSession();
  const kept = (s.exercises || []).map(e => Object.assign({}, e, { sets: e.sets.filter(x => x.done) })).filter(e => e.sets.length);
  t.ex.forEach(([name, sets]) => {
    if (kept.some(e => e.name === name)) return;
    const last = lastExercise(u, name, d); const ls = last ? last.ex.sets.filter(x => x.done) : [];
    kept.push({ name, sets: Array.from({ length: sets }, (_, i) => ({ kg: ls[i] ? ls[i].kg : (ls[0] ? ls[0].kg : ''), reps: '', done: false })) });
  });
  saveSession(u, d, Object.assign({}, s, { tpl: k, exercises: kept, finished: false })); closeSheet(); render(); window.scrollTo(0, 0);
}
function curSession() { return session(me(), UI.wdate) || { exercises: [], cardio: [] }; }
function startRest(sec) { UI.rest = { end: Date.now() + sec * 1000 }; tickRest(); }
function tickRest() {
  const box = $('#restBox'); if (!UI.rest) { box.innerHTML = ''; return; }
  const left = Math.ceil((UI.rest.end - Date.now()) / 1000);
  if (left <= 0) { box.innerHTML = ''; UI.rest = null; try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { } toast('休息結束，下一組'); return; }
  box.innerHTML = `<div class="rest">⚾ 休息 ${Math.floor(left / 60)}:${z2(left % 60)}<button data-act="restAdd">+30秒</button><button data-act="restStop">略過</button></div>`;
}
setInterval(() => { if (UI.rest) tickRest(); }, 500);
function compressImage(file, max, q) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => { const sc = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', q).split(',')[1]); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('照片格式不支援')); }; img.src = url;
  });
}
function startPeriod(date) {
  const u = me(); const act = cycles(u).find(c => !c.end && dayNum(date) - dayNum(c.start) < 10 && c.start <= date);
  if (act) { toast('已經有進行中的經期紀錄'); return; }
  put({ id: 'cy_' + u + '_' + date, uid: u, type: 'cycle', date, data: { start: date, end: '' } });
}
function endPeriod(date) {
  const u = me(); const cs = cycles(u).filter(c => !c.end && c.start <= date); if (!cs.length) { toast('找不到進行中的經期'); return; }
  const c = cs[cs.length - 1]; put({ id: c.id, uid: u, type: 'cycle', date: c.start, data: { start: c.start, end: date } });
}

/* ---------- AI ---------- */
async function onAIFile(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  try { UI.ai.img = await compressImage(file, UI.ai.mode === 'body' || UI.ai.mode === 'label' ? 1400 : 1024, 0.82); UI.ai.items = UI.ai.label = UI.ai.body = null; UI.ai.err = ''; keepAIInputs(); renderAISheet(); }
  catch (err) { toast('讀取照片失敗：' + err.message); }
}
function keepAIInputs() { const h = $('#aiHint'), m = $('#aiMeal'); if (h) UI.ai.hint = h.value; if (m) UI.ai.meal = m.value; }
async function runAI() {
  const a = UI.ai; keepAIInputs();
  if (a.mode !== 'text' && !a.img) { toast('請先選一張照片'); return; }
  if (a.mode === 'text' && !(a.hint || '').trim()) { toast('請先描述吃了什麼'); return; }
  a.busy = true; a.err = ''; renderAISheet();
  try {
    const j = await api('analyze', { mode: a.mode === 'text' ? 'food' : a.mode === 'photo' ? 'food' : a.mode, image: a.mode !== 'text' ? a.img : '', hint: a.hint || '' }, 90000);
    if (a.mode === 'label') { a.label = j.label; if (!a.label) a.err = '讀不到營養標示，請拍正、拍清楚再試一次。'; }
    else if (a.mode === 'body') { a.body = j.body; if (!a.body || !Object.keys(a.body).length) a.err = '讀不到數字，請確認是 bpt care 的報告頁截圖。'; }
    else {
      a.items = (j.items || []).map(x => ({ name: x.name, grams: num(x.grams), kcal: num(x.kcal), p: num(x.protein), c: num(x.carbs), f: num(x.fat), fib: num(x.fiber), na: num(x.sodium), confidence: x.confidence, on: true }));
      a.items.forEach(x => { x.base = { grams: x.grams, kcal: x.kcal, p: x.p, c: x.c, f: x.f, fib: x.fib, na: x.na }; });
      a.note = j.note || ''; if (!a.items.length) a.err = '沒有辨識到食物，換個角度或加上文字說明再試一次。';
    }
  } catch (e) { a.err = e.message; }
  a.busy = false; if (UI.ai === a) renderAISheet();
}
function aiTotals() { const a = UI.ai; if (!a || !a.items) return; const t = a.items.filter(x => x.on).reduce((s, x) => ({ kcal: s.kcal + num(x.kcal), p: s.p + num(x.p) }), { kcal: 0, p: 0 }); const el = $('#aiTot'); if (el) el.textContent = `${r0(t.kcal)} kcal · 蛋白質 ${r0(t.p)} g`; }

/* ---------- 照片比較 ---------- */
async function onPhotoFile(e) {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  if (!S.cfg.apiUrl) { toast('請先完成雲端設定'); return; }
  const u = me(), d = todayStr(), pose = UI.photo.pose;
  toast('上傳中…', 4000);
  try {
    const img = await compressImage(file, 1080, 0.82);
    const j = await api('photoSave', { uid: u, date: d, pose, image: img }, 90000);
    UI.imgCache[j.fileId] = img;
    put({ id: `ph_${u}_${d}_${pose}`, uid: u, type: 'photo', date: d, data: { fileId: j.fileId, pose } });
    UI.photo.b = d; UI.photo.manual = false; toast('已存到雲端硬碟'); render();
  } catch (err) { toast('上傳失敗：' + err.message, 4000); }
}
async function getPhoto(fileId) {
  if (UI.imgCache[fileId]) return UI.imgCache[fileId];
  const j = await api('photoGet', { fileId }, 60000); UI.imgCache[fileId] = j.image; return j.image;
}
async function loadCompare() {
  const v = viewUid(), P = UI.photo; const box = $('#cmpBox'); if (!box) return;
  const find = d => recs('photo', v).find(r => r.date === d && r.data.pose === P.pose);
  const ra = find(P.a), rb = find(P.b); if (!ra || !rb) return;
  try {
    const [ia, ib] = await Promise.all([getPhoto(ra.data.fileId), getPhoto(rb.data.fileId)]);
    if (!$('#cmpBox')) return;
    $('#cmpBox').innerHTML = `<img src="data:image/jpeg;base64,${ia}" alt=""><img class="top" id="cmpTop" src="data:image/jpeg;base64,${ib}" alt="" style="clip-path:inset(0 0 0 ${P.pos}%)">
      <span class="lbl" style="left:8px">${md(P.a)}</span><span class="lbl" style="right:8px">${md(P.b)}</span>`;
  } catch (e) { if ($('#cmpBox')) $('#cmpBox').innerHTML = `<div class="empty" style="position:absolute;inset:0;justify-content:center">照片載入失敗：${esc(e.message)}</div>`; }
}

/* ---------- 應援 ---------- */
function sheetCheer() {
  const o = otherUid(me());
  openSheet(`<h3>${icon('cheer')} 給 ${esc(nameOf(o))} 應援<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    <div class="chips">${CHEER_QUICK.map(t => `<button data-act="cheerQuick" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>
    <label class="f">或自己寫</label><input type="text" id="cheerTxt" maxlength="60" placeholder="想說的話">
    <button class="btn gold block mt12" data-act="sendCheer">送出</button>
    <div class="tiny muted mt8">對方打開 App 時，右上角的鈴鐺會亮起。</div>`);
}
function sendCheer(msg) {
  msg = (msg || '').trim(); if (!msg) { toast('寫點什麼吧'); return; }
  const o = otherUid(me());
  put({ id: newId('ch'), uid: me(), type: 'cheer', date: todayStr(), data: { to: o, msg, hm: nowHM() } });
  closeSheet(); toast('已送出'); render();
}

/* ---------- 事件 ---------- */
const ACT = {
  tab: el => { UI.tab = el.dataset.tab; if (UI.tab !== 'set') { UI.draft = null; UI.previewStage = null; } window.scrollTo(0, 0); render(); },
  syncNow: () => { if (!S.cfg.apiUrl) { UI.tab = 'set'; render(); return; } syncNow().then(() => toast(S.syncErr ? '同步失敗：' + S.syncErr : '已同步')); },
  pickView: el => { UI.view = el.dataset.uid; render(); },
  iam: el => { S.cfg.me = el.dataset.uid; UI.view = null; UI.editUid = el.dataset.uid; UI.draft = null; persist(); if (!hasProfile(S.cfg.me)) UI.tab = 'set'; render(); },
  closeSheet: () => closeSheet(),
  // 打卡
  checkin: () => sheetCheckin(),
  ck: el => { const k = el.dataset.k, v = el.dataset.v; UI.ck[k] = UI.ck[k] === v ? '' : v; $$(`[data-ckrow="${k}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === UI.ck[k])); },
  saveCheckin: () => {
    const w = num($('#ck_w').value); if (w && (w < 25 || w > 300)) { toast('體重數字看起來不對'); return; }
    const old = daily(me(), todayStr()); const patch = { sleep: UI.ck.sleep, bowel: UI.ck.bowel, stress: UI.ck.stress, alcohol: $('#ck_alc').checked, checkin: true };
    if (w && w !== num(old.weight)) { patch.weight = w; patch.wsrc = 'manual'; patch.weighTime = nowHM(); }
    saveDaily(me(), todayStr(), patch);
    if (UI.ck.period === 'start') startPeriod(todayStr()); if (UI.ck.period === 'end') endPeriod(todayStr());
    closeSheet(); UI.tab = 'home'; UI.view = null; render(); window.scrollTo(0, 0);
  },
  answer: el => { const k = el.dataset.k, v = el.dataset.v; const dd = daily(me(), todayStr()); saveDaily(me(), todayStr(), { answers: Object.assign({}, dd.answers || {}, { [k]: v }) }); if (k === 'period' && v === 'in') startPeriod(todayStr()); render(); },
  water: el => { const d = UI.tab === 'food' ? UI.fdate : todayStr(); saveDaily(me(), d, { waterMl: num(daily(me(), d).waterMl) + num(el.dataset.n) }); render(); },
  gameDay: () => { const d = UI.fdate; saveDaily(me(), d, { gameDay: !daily(me(), d).gameDay }); render(); },
  // 飲食
  fdate: el => { UI.fdate = addDays(UI.fdate, +el.dataset.d); if (UI.fdate > todayStr()) UI.fdate = todayStr(); render(); },
  aiPhoto: () => sheetAI('photo'), aiText: () => sheetAI('text'), aiLabel: () => sheetAI('label'), aiBody: () => sheetAI('body'),
  aiPick: () => { keepAIInputs(); $('#aiFile').click(); }, aiRun: () => runAI(),
  aiSave: () => {
    const a = UI.ai; keepAIInputs(); const sel = a.items.filter(x => x.on); if (!sel.length) { toast('沒有勾選任何項目'); return; }
    const toLib = $('#aiLib') && $('#aiLib').checked; const split = readSplit();
    const items = sel.map(x => ({ name: x.name, unit: r0(x.grams) + 'g', qty: 1, kcal: r0(x.kcal), p: r1(x.p), c: r1(x.c), f: r1(x.f), fib: r1(x.fib), na: r0(x.na), src: 'ai' }));
    saveFoodItems(items, a.meal, split); if (toLib) items.forEach(saveLib);
    closeSheet(); toast(`已加入 ${sel.length} 項`); render();
  },
  lbQty: el => { $('#lb_qty').value = el.dataset.v; },
  lbSave: () => {
    const a = UI.ai; keepAIInputs(); const v = k => num($('#lb_' + k).value);
    const d = { name: $('#lb_name').value.trim() || '包裝食品', unit: '1份 ' + (a.label.servingDesc || ''), qty: num($('#lb_qty').value) || 1, kcal: v('kcal'), p: v('protein'), c: v('carbs'), f: v('fat'), fib: v('fiber'), na: v('sodium'), src: 'label' };
    saveFoodItems([d], a.meal, readSplit()); if ($('#aiLib').checked) saveLib(d);
    closeSheet(); toast('已加入'); render();
  },
  bdSave: () => {
    const patch = { wsrc: 'scan' }; BODY_FIELDS.forEach(([k]) => { const x = $('#bd_' + k).value; if (x !== '') patch[k] = num(x); });
    const d = $('#bd_date').value || todayStr(); if (patch.weight && (patch.weight < 25 || patch.weight > 300)) { toast('體重數字看起來不對'); return; }
    if (patch.weight && num(daily(me(), d).weight)) delete patch.weight; // 當天已有體重（早上量的）就不覆蓋
    saveDaily(me(), d, patch); closeSheet(); toast('已存到身體紀錄'); render();
  },
  lib: el => sheetLib(el.dataset.meal),
  libPick: el => { const x = findLib(el.dataset.src, el.dataset.id); if (!x) return; const meal = $('#libMeal').value; sheetFoodForm({ title: '加入 ' + x.name, data: Object.assign({}, x, { qty: 1 }), meal }); },
  manual: () => sheetFoodForm({ title: '手動輸入', data: {}, meal: defaultMeal() }),
  editFood: el => { const r = S.records[el.dataset.id]; if (!r) return; sheetFoodForm({ title: '編輯', data: r.data, id: r.id, meal: r.data.meal }); },
  qty: el => { const i = $('#ff_qty'); i.value = r1(Math.max(0.25, num(i.value) + num(el.dataset.d))); },
  saveFood: () => {
    const d = readFoodForm(); const ctx = UI.formCtx;
    if (!d.kcal && !d.p && !d.c && !d.f) { toast('請至少填熱量'); return; }
    const data = { name: d.name, unit: d.unit, qty: d.qty, kcal: d.kcal, p: d.p, c: d.c, f: d.f, fib: d.fib, na: d.na };
    const split = readSplit();
    if (ctx.id && split) { // 既有的一筆改成「一起吃」：自己留比例，其餘記到對方
      const r = S.records[ctx.id]; const gid = newId('g'); const q = d.qty;
      put(Object.assign({}, r, { data: Object.assign({}, r.data, data, { meal: d.meal, qty: r1(q * split * 100) / 100, gid, by: me() }) }));
      put(foodRec(Object.assign({}, r.data, data, { meal: d.meal, qty: r1(q * (1 - split) * 100) / 100, gid, by: me(), t: Date.now() }), r.date, otherUid(me())));
    } else if (ctx.id) { const r = S.records[ctx.id]; put(Object.assign({}, r, { data: Object.assign({}, r.data, data, { meal: d.meal }) })); }
    else saveFoodItems([Object.assign(data, { src: 'manual' })], d.meal, split);
    if ($('#ff_lib').checked) saveLib(d);
    closeSheet(); render();
  },
  delFood: () => { if (!confirm('刪除這筆？')) return; removeRec(UI.formCtx.id); closeSheet(); render(); },
  copyMeal: el => {
    const m = el.dataset.meal; const src = foodEntries(me(), addDays(UI.fdate, -1)).filter(e => e.data.meal === m);
    if (!src.length) { toast('前一天沒有' + m + '的記錄'); return; }
    src.forEach((e, i) => { const d = Object.assign({}, e.data, { t: Date.now() + i }); delete d.gid; delete d.by; put(foodRec(d)); }); toast(`已複製 ${src.length} 項`); render();
  },
  // 應援
  cheer: () => sheetCheer(), cheerQuick: el => sendCheer(el.dataset.v), sendCheer: () => sendCheer($('#cheerTxt').value),
  // 運動
  wdate: el => { UI.wdate = addDays(UI.wdate, +el.dataset.d); if (UI.wdate > todayStr()) UI.wdate = todayStr(); render(); },
  gotoW: el => { UI.wdate = el.dataset.d; window.scrollTo(0, 0); render(); },
  startTpl: el => startTpl(el.dataset.tpl), addEx: () => sheetAddEx(),
  changeTpl: () => openSheet(`<h3>換菜單<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    <div class="small muted">已經打勾完成的組數會保留，其餘換成新菜單的動作。</div><div class="mt12">${tplPicker(profile(me()), nextTpl(me()), 'swapTpl')}</div>
    <div class="hr"></div><button class="btn block danger" data-act="clearSession">全部清空，重新選</button>`),
  swapTpl: el => swapTpl(el.dataset.tpl),
  clearSession: () => { if (!confirm('清空今天的重訓紀錄（有氧不受影響）？')) return; const s = curSession(); saveSession(me(), UI.wdate, Object.assign({}, s, { tpl: '', exercises: [], finished: false })); closeSheet(); render(); },
  finishSession: () => { const s = curSession(); const n = (s.exercises || []).reduce((a, e) => a + e.sets.filter(x => x.done).length, 0);
    if (!n && !confirm('還沒有打勾任何一組，確定結束？')) return;
    saveSession(me(), UI.wdate, Object.assign({}, s, { finished: true })); UI.rest = null; tickRest(); toast(`已記錄 ${n} 組`); render(); window.scrollTo(0, 0); },
  reopenSession: () => { const s = curSession(); saveSession(me(), UI.wdate, Object.assign({}, s, { finished: false })); render(); },
  saveTplSheet: () => { const s = curSession(); const ex = (s.exercises || []).filter(e => e.sets.length); if (!ex.length) { toast('先加入動作'); return; }
    openSheet(`<h3>存成我的菜單<button class="btn sm ghost x" data-act="closeSheet">取消</button></h3>
      <label class="f">菜單名稱</label><input type="text" id="tplName" maxlength="20" placeholder="例如：臀腿日、上半身推" value="">
      <div class="small muted mt8">${ex.map(e => `${esc(e.name)} ${e.sets.length} 組`).join('<br>')}</div>
      <div class="tiny muted mt8">會記住動作和組數，重量每次自動帶入上次的數字。兩人都可以使用。</div>
      <button class="btn pri block mt12" data-act="saveTpl">儲存</button>`); },
  saveTpl: () => { const name = $('#tplName').value.trim(); if (!name) { toast('請取個名字'); return; } const s = curSession();
    const ex = s.exercises.filter(e => e.sets.length).map(e => { const [lo, hi] = tplRange(s.tpl, e.name); return [e.name, e.sets.length, `${lo}-${hi}`]; });
    const id = newId('tpl'); put({ id, uid: me(), type: 'tpl', date: '', data: { name, ex } });
    saveSession(me(), UI.wdate, Object.assign({}, s, { tpl: id })); closeSheet(); toast('已存成「' + name + '」'); render(); },
  delTpl: el => { const r = S.records[el.dataset.id]; if (!r || !confirm(`刪除菜單「${r.data.name}」？（過去的訓練紀錄不受影響）`)) return; removeRec(r.id); render(); },
  jersey: el => { UI.draft.p.avatar.jersey = el.dataset.v; $$('[data-act="jersey"]').forEach(b => b.classList.toggle('on', b === el)); refreshPreview(); },
  exPick: el => {
    const name = el.dataset.n; const s = curSession(); const last = lastExercise(me(), name, UI.wdate); const ls = last ? last.ex.sets.filter(x => x.done) : [];
    s.exercises = s.exercises || []; s.exercises.push({ name, sets: (ls.length ? ls : [{}, {}, {}]).map(x => ({ kg: x.kg ?? '', reps: '', done: false })) });
    saveSession(me(), UI.wdate, s); closeSheet(); render();
  },
  exMenu: el => { const ei = +el.dataset.ei;
    openSheet(`<h3>${esc(curSession().exercises[ei].name)}<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
      <div class="grid2"><button class="btn" data-act="exMove" data-ei="${ei}" data-d="-1">上移</button><button class="btn" data-act="exMove" data-ei="${ei}" data-d="1">下移</button></div>
      <button class="btn block danger mt12" data-act="exDel" data-ei="${ei}">刪除這個動作</button>`); },
  exMove: el => { const s = curSession(), i = +el.dataset.ei, j = i + (+el.dataset.d); if (j < 0 || j >= s.exercises.length) return; [s.exercises[i], s.exercises[j]] = [s.exercises[j], s.exercises[i]]; saveSession(me(), UI.wdate, s); closeSheet(); render(); },
  exDel: el => { const s = curSession(); s.exercises.splice(+el.dataset.ei, 1); saveSession(me(), UI.wdate, s); closeSheet(); render(); },
  addSet: el => { const s = curSession(), e = s.exercises[+el.dataset.ei]; const prev = e.sets[e.sets.length - 1] || {}; e.sets.push({ kg: prev.kg ?? '', reps: prev.reps ?? '', done: false }); saveSession(me(), UI.wdate, s); render(); },
  delSet: el => { const s = curSession(), e = s.exercises[+el.dataset.ei]; if (e.sets.length > 1) e.sets.pop(); saveSession(me(), UI.wdate, s); render(); },
  setDone: el => {
    const s = curSession(), e = s.exercises[+el.dataset.ei], st = e.sets[+el.dataset.si];
    $$('input', el.closest('tr')).forEach(i => { st[i.dataset.k] = i.value === '' ? '' : num(i.value); });
    if (!st.done && (st.reps === '' || st.reps == null)) st.reps = tplRange(s.tpl, e.name)[0];
    st.done = !st.done; saveSession(me(), UI.wdate, s);
    if (st.done) startRest(/深蹲|硬舉|腿推|臥推|划船|臀推/.test(e.name) ? 120 : 75);
    render();
  },
  restAdd: () => { if (UI.rest) { UI.rest.end += 30000; tickRest(); } }, restStop: () => { UI.rest = null; tickRest(); },
  addCardio: () => sheetCardio(null), editCardio: el => sheetCardio(+el.dataset.ci),
  saveCardio: () => { const s = curSession(); s.cardio = s.cardio || []; const c = readCardio(); if (!c.min) { toast('請填時間'); return; } if (UI.cardioIdx != null) s.cardio[UI.cardioIdx] = c; else s.cardio.push(c); saveSession(me(), UI.wdate, s); closeSheet(); render(); },
  delCardio: () => { const s = curSession(); s.cardio.splice(UI.cardioIdx, 1); saveSession(me(), UI.wdate, s); closeSheet(); render(); },
  // 身體
  saveBody: () => {
    const v = id => num($(id).value); const w = v('#b_weight');
    if (w && (w < 25 || w > 300)) { toast('體重數字看起來不對'); return; }
    const old = daily(me(), todayStr()); if (w && old.weight && Math.abs(w - num(old.weight)) > 3 && !confirm('和今天稍早的數字差超過 3 kg，確定嗎？')) return;
    const patch = { waist: v('#b_waist') || '', hip: v('#b_hip') || '', bf: v('#b_bf') || old.bf || '' };
    if (w && w !== num(old.weight)) { patch.weight = w; patch.wsrc = 'manual'; patch.weighTime = nowHM(); }
    saveDaily(me(), todayStr(), patch); toast('已儲存'); render();
  },
  bodyRange: el => { UI.bodyRange = +el.dataset.n; render(); },
  applyTdee: el => { const p = profile(me()); p.tdeeOverride = num(el.dataset.v); saveProfile(me(), p); toast(p.tdeeOverride ? '已改用實測 TDEE' : '已改回公式估算'); render(); },
  periodStart: () => { startPeriod(todayStr()); render(); },
  periodEnd: () => { endPeriod(todayStr()); render(); },
  periodPast: () => openSheet(`<h3>補記經期<button class="btn sm ghost x" data-act="closeSheet">取消</button></h3>
    <label class="f">開始日期</label><input type="date" id="pp_s" max="${todayStr()}"><label class="f">結束日期（選填）</label><input type="date" id="pp_e" max="${todayStr()}">
    <button class="btn pri block mt12" data-act="savePast">儲存</button>`),
  savePast: () => { const s = $('#pp_s').value, e = $('#pp_e').value; if (!s) { toast('請選開始日期'); return; } if (e && e < s) { toast('結束日期早於開始'); return; }
    put({ id: 'cy_' + me() + '_' + s, uid: me(), type: 'cycle', date: s, data: { start: s, end: e || (s < addDays(todayStr(), -10) ? addDays(s, (num(profile(me()).periodLen) || 5) - 1) : '') } }); closeSheet(); render(); },
  photoPose: el => { UI.photo.pose = el.dataset.v; UI.photo.a = UI.photo.b = ''; render(); },
  photoAdd: () => { if (!S.cfg.apiUrl) { toast('請先完成雲端設定'); return; } $('#phFile').click(); },
  // 設定
  editUid: el => { UI.editUid = el.dataset.uid; UI.draft = null; UI.previewStage = null; render(); },
  previewStage: el => { UI.previewStage = el.dataset.v; $$('[data-act="previewStage"]').forEach(b => b.classList.toggle('on', b === el)); refreshPreview(); },
  sw: el => { const k = el.dataset.k; const av = UI.draft.p.avatar;
    if (k.startsWith('oc:')) { const oid = v2OutfitId(av); av.oc = av.oc || {}; av.oc[oid] = Object.assign({}, av.oc[oid], { [k.slice(3)]: el.dataset.v }); $$(`.sw[data-k="${k}"]`).forEach(b => b.classList.toggle('on', b === el)); refreshPreview(); return; }
    UI.draft.p.avatar[el.dataset.k] = el.dataset.v; $$(`.sw[data-k="${el.dataset.k}"]`).forEach(b => b.classList.toggle('on', b === el)); refreshPreview(); },
  saveProfile: () => {
    const p = readProfileForm();
    if (!(p.height > 120 && p.height < 230)) { toast('請確認身高'); return; }
    if (!(p.startWeight > 30 && p.goalWeight > 30)) { toast('請確認起始與目標體重'); return; }
    if (!(p.birthYear > 1930 && p.birthYear <= new Date().getFullYear() - 14)) { toast('請確認出生年'); return; }
    p.setup = true; saveProfile(UI.draft.uid, p);
    if (UI.draft.uid === me() && !weights(me()).length) saveDaily(me(), todayStr(), { weight: p.startWeight, wsrc: 'manual' });
    toast('已儲存'); UI.draft = null; UI.tab = 'home'; render();
  },
  testApi: async () => { S.cfg.apiUrl = $('#cfgUrl').value.trim(); S.cfg.token = $('#cfgTok').value.trim(); persist();
    try { const j = await api('ping'); toast('連線成功' + (j.ai ? '，AI 已啟用' : '，但 AI 金鑰尚未設定') + (j.drive ? '' : '，雲端硬碟未授權'), 3500); render(); } catch (e) { toast('失敗：' + e.message, 4000); } },
  saveCfg: async () => { S.cfg.apiUrl = $('#cfgUrl').value.trim(); S.cfg.token = $('#cfgTok').value.trim();
    if (S.cfg.apiUrl && !/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(S.cfg.apiUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)/.test(S.cfg.apiUrl)) toast('網址格式通常是 https://script.google.com/macros/s/…/exec', 3500);
    Object.keys(S.records).forEach(id => { if (!S.pending.includes(id)) S.pending.push(id); });
    S.lastTs = 0; persist(); await syncNow(); toast(S.syncErr ? '同步失敗：' + S.syncErr : '已同步', 3000); render(); },
  guideShortcut: () => sheetShortcutGuide(),
  notif: () => { sheetNotif(); markNotifSeen(); persist(); setBell(); },
  notifGo: el => { const n = notifications().find(x => x.id === el.dataset.id); closeSheet(); if (!n) return; if (n.act === 'tab') { UI.tab = n.v; window.scrollTo(0, 0); render(); } else if (ACT[n.act]) ACT[n.act](el); },
  exportJson: () => { const blob = new Blob([JSON.stringify({ app: 'c17', v: APP_VERSION, at: new Date().toISOString(), records: S.records }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `減脂Fight備份_${todayStr()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); },
  importJson: () => { const i = $('#impFile'); i.onchange = async () => { try { const j = JSON.parse(await i.files[0].text()); if (!j.records) throw new Error('不是備份檔'); let n = 0;
      Object.values(j.records).forEach(r => { const l = S.records[r.id]; if (!l || num(r.updatedAt) > num(l.updatedAt)) { S.records[r.id] = r; if (!S.pending.includes(r.id)) S.pending.push(r.id); n++; } });
      persist(); queueSync(); toast(`已匯入 ${n} 筆`); render(); } catch (e) { toast('匯入失敗：' + e.message); } }; i.click(); },
  resetLocal: () => { if (!confirm('會清除這支手機上的資料與設定（雲端的不受影響）。確定？')) return; localStorage.removeItem(LS_KEY); S = defaultState(); UI.draft = null; UI.tab = 'home'; render(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return; e.preventDefault(); fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target; const c = el.dataset.chg;
  if (c === 'set') {
    const s = curSession(); const ei = +el.dataset.ei, si = +el.dataset.si, k = el.dataset.k; const e = s.exercises[ei]; const st = e.sets[si];
    const old = st[k]; const v = el.value === '' ? '' : num(el.value); st[k] = v;
    if (k === 'kg' && v !== '') e.sets.forEach((x, j) => { // 後面還沒做的組，沿用這一組的重量
      if (j > si && !x.done && (x.kg === '' || x.kg == null || x.kg === old)) { x.kg = v; const inp = $(`input[data-chg="set"][data-ei="${ei}"][data-si="${j}"][data-k="kg"]`); if (inp) inp.value = v; }
    });
    saveSession(me(), UI.wdate, s); return;
  }
  if (c === 'steps') { saveDaily(me(), UI.wdate, { steps: num(el.value) || '' }); return; }
  if (c === 'progEx') { UI.progEx = el.value; render(); return; }
  if (c === 'month') { UI.month = el.value; render(); return; }
  if (c === 'phA' || c === 'phB') { UI.photo[c === 'phA' ? 'a' : 'b'] = el.value; UI.photo.manual = true; loadCompare(); return; }
  if (c === 'aiOn') { UI.ai.items[+el.dataset.i].on = el.checked; el.closest('.ai-item').classList.toggle('off', !el.checked); aiTotals(); return; }
  if (el.id === 'aiMeal' && UI.ai) { UI.ai.meal = el.value; const b = $('[data-act="aiSave"],[data-act="lbSave"]'); if (b) b.textContent = '加入' + el.value; return; }
  if ((el.dataset.pf || el.dataset.av) && UI.tab === 'set') { if (el.dataset.pf === 'sex' || el.dataset.av === 'outfit' || el.dataset.av === 'charV2') { readProfileForm(); render(); return; } refreshPreview(); }
});
document.addEventListener('input', e => {
  const el = e.target; const a = UI.ai; const k = el.dataset.inp;
  if (k === 'aiG' && a) { const it = a.items[+el.dataset.i]; const g = num(el.value); const b = it.base; const r = b.grams > 0 ? g / b.grams : 1; it.grams = g;
    ['kcal', 'p', 'c', 'f', 'fib', 'na'].forEach(x => { it[x] = b[x] * r; });
    $$('[data-inp="aiV"]', el.closest('.ai-item')).forEach(i => { i.value = (i.dataset.k === 'kcal' || i.dataset.k === 'na') ? r0(it[i.dataset.k]) : r1(it[i.dataset.k]); }); aiTotals(); return; }
  if (k === 'aiV' && a) { const it = a.items[+el.dataset.i]; it[el.dataset.k] = num(el.value); it.base = { grams: it.grams, kcal: it.kcal, p: it.p, c: it.c, f: it.f, fib: it.fib, na: it.na }; aiTotals(); return; }
  if (k === 'aiName' && a) { a.items[+el.dataset.i].name = el.value; return; }
  if (k === 'phPos') { UI.photo.pos = num(el.value); const t = $('#cmpTop'); if (t) t.style.clipPath = `inset(0 0 0 ${UI.photo.pos}%)`; return; }
  if ((el.dataset.pf || el.dataset.av) && UI.tab === 'set') refreshPreview();
});
document.addEventListener('focusout', () => { setTimeout(() => { if (UI.needRender && !isEditing()) { UI.needRender = false; render(); } }, 300); });

/* ---------- 啟動 ---------- */
if (S.cfg.me) UI.editUid = S.cfg.me;
render();
if (S.cfg.apiUrl) { syncNow(); }
setInterval(setBell, 5 * 60e3);  // 跨過 20:00 等時間點時更新鈴鐺
