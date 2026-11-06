'use strict';
/* =========================================================
   兩人減脂 v2 — 畫面
   ========================================================= */
const UI = { tab: 'home', view: null, fdate: todayStr(), wdate: todayStr(), bodyRange: 30, editUid: null, draft: null, ai: null, rest: null, progEx: '', needRender: false, sheetOpen: false, month: todayStr().slice(0, 7), photo: { pose: 'front', a: '', b: '', pos: 50 }, imgCache: {} };
const me = () => S.cfg.me;
const viewUid = () => UI.view || S.cfg.me || 'A';
const colorOf = u => u === 'B' ? '#e0a800' : '#1f2d4d';
const CHEER_QUICK = ['今天也一起加油', '蛋白質記得吃夠', '練完了嗎？我在等你', '你今天很棒', '早點睡，明天再戰', '看球不忘記錄'];

/* ====================== 總覽 ====================== */
function viewHome() {
  if (!me()) return viewWelcome();
  const v = viewUid(); const mine = v === me(); const t = todayStr();
  let h = '<div class="field"><div class="couple">';
  UIDS.forEach(u => {
    const p = profile(u); const has = hasProfile(u); const tg = targets(u); const s = dayFood(u, t); const pct = progressPct(u);
    h += `<div class="pcard ${u === 'B' ? 'b' : ''} ${u === v ? 'sel' : ''}" data-act="pickView" data-uid="${u}">
      ${u === me() ? '<span class="me-tag">我</span>' : ''}
      ${renderAvatar(u, p.avatar, fatness(u), { expr: has ? exprFor(u) : 'calm' })}
      <div class="nm">${esc(p.name)}</div>
      ${has ? `<div class="stat">${diamondSVG(pct, colorOf(u), 40)}<div class="t"><b>${baseName(pct)}</b> ${r0(pct)}%<br><span class="muted">${r1(trendWeight(u))} kg · ${r0(s.kcal)}/${tg.kcal}</span></div></div>`
        : `<div class="small muted mt8">${u === me() ? '請先到「設定」填資料' : '等對方在自己手機設定'}</div>`}
    </div>`;
  });
  h += `</div>${catSVG('orange', 'sit', 30).replace('class="cat"', 'class="cat l"')}${catSVG('tabby', 'sit', 30).replace('class="cat"', 'class="cat r"')}</div>`;
  if (hasProfile(otherUid(me()))) h += `<div class="row mt8" style="justify-content:flex-end"><button class="btn sm" data-act="cheer">${icon('cheer')} 給 ${esc(nameOf(otherUid(me())))} 應援</button></div>`;
  // 收到的應援
  if (mine) {
    const cs = recs('cheer').filter(r => r.data.to === me() && r.date >= addDays(t, -1)).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 2);
    cs.forEach(c => { h += `<div class="cheer">${icon('cheer')}<div class="grow"><b>${esc(nameOf(c.uid))}</b>：${esc(c.data.msg)}<div class="tiny muted">${prettyDate(c.date)} ${esc(c.data.hm || '')}</div></div></div>`; });
  }
  if (!hasProfile(v)) return h + `<div class="card center muted">${mine ? '<p>先完成個人資料，才能計算熱量與營養目標。</p><button class="btn pri" data-act="tab" data-tab="set">前往設定</button>' : '對方還沒有設定資料。'}</div>`;
  const p = profile(v); const tg = targets(v); const s = dayFood(v, t); const dd = daily(v, t);
  if (!mine) h += `<div class="note mt12">正在查看 ${esc(p.name)} 的資料</div>`;
  // 晨間打卡 / 體重解讀
  const ex = explainWeight(v, t);
  if (mine && !dd.checkin) {
    h += `<div class="card"><h2>晨間打卡<span class="sub">約 10 秒</span></h2>
      <div class="small">${num(dd.weight) ? `體重 <b>${r1(dd.weight)} kg</b> ${dd.wsrc === 'health' ? '已從體重機同步' : '已記錄'}。` : '起床、上完廁所、吃東西前量體重。'}再點幾個狀態，就能解讀今天體重的變化。</div>
      <button class="btn gold block mt12" data-act="checkin">開始打卡</button></div>`;
  }
  if (ex) {
    h += `<div class="card explain"><h2>體重解讀<span class="sub">${r1(ex.w)} kg${ex.dayJump != null ? `（比昨天 ${ex.dayJump >= 0 ? '+' : ''}${r1(ex.dayJump)}）` : ''}</span></h2>
      <div class="head">${esc(ex.headline)}</div>
      ${ex.causes.length ? `<ol>${ex.causes.map(c => `<li>${esc(c.text)}</li>`).join('')}</ol>` : ''}
      ${ex.causes.length && ex.up ? `<div class="small muted mt8">${ex.trendTxt ? ex.trendTxt + '。' : ''}這些都是暫時的水分變化，不需要調整飲食。</div>` : ''}
      ${ex.question && mine ? `<div class="qbox"><div class="small"><b>${esc(ex.question.text)}</b></div><div class="chips mt8">${ex.question.options.length ? ex.question.options.map(o => `<button data-act="answer" data-k="${ex.question.key}" data-v="${o[0]}">${o[1]}</button>`).join('') : '<button data-act="checkin">開始打卡</button>'}</div></div>` : ''}
    </div>`;
  }
  // 今日飲食
  const water = num(dd.waterMl);
  h += `<div class="card"><h2>今日飲食<span class="sub">目標 ${tg.kcal} kcal${dd.gameDay ? ' · <span class="chip gold">看球日</span>' : ''}</span></h2>
    <div class="today">${ballRing(s.kcal, tg.kcal)}<div>
      ${macroRow('蛋白質', s.p, tg.p, 'var(--p)', 'g', 'min')}${macroRow('碳水', s.c, tg.c, 'var(--c)')}${macroRow('脂肪', s.f, tg.f, 'var(--f)')}${macroRow('纖維', s.fib, tg.fib, 'var(--fib)', 'g', 'min')}
      ${s.naKnown ? macroRow('鈉', s.na, tg.na, 'var(--na)', 'mg') : ''}
    </div></div>
    <div class="water mt12">${icon('drop')}<span class="small">${r0(water)} / ${tg.water} ml</span><div class="bar"><i style="width:${clamp(water / tg.water * 100, 0, 100)}%"></i></div>${mine ? '<button class="btn sm" data-act="water" data-n="250">+250</button>' : ''}</div>
    ${mine ? `<div class="grid2 mt12"><button class="btn" data-act="aiPhoto">${icon('cam')} 拍照記錄</button><button class="btn" data-act="tab" data-tab="food">飲食明細</button></div>` : ''}
  </div>`;
  const adv = adviceFor(v);
  if (adv.length) h += `<div class="card advice"><h2>建議</h2>${adv.map(a => `<p>${esc(a)}</p>`).join('')}</div>`;
  // 運動
  const st = sessionStats(v, t); const ws = weekStats(v); const nt = nextTpl(v);
  h += `<div class="card"><h2>運動狀態<span class="sub">本週 ${ws.train} / ${ws.plan} 次</span></h2>
    <div class="grid3">
      <div class="kv" style="grid-template-columns:1fr"><div><b>${st.sets}</b><span>重訓組數</span></div></div>
      <div class="kv" style="grid-template-columns:1fr"><div><b>${st.cardioMin}</b><span>有氧分鐘</span></div></div>
      <div class="kv" style="grid-template-columns:1fr"><div><b>${st.steps ? st.steps.toLocaleString() : '—'}</b><span>步數</span></div></div>
    </div>
    <div class="small muted mt8">${st.sets || st.cardioMin ? `今日運動淨消耗約 ${r0(st.cardioKcal + st.sets * 7)} kcal（已含在每日目標內，不需要另外吃回來）` : `下一場先發：${TPL[nt].name}（${TPL[nt].ex.slice(0, 3).map(e => e[0]).join('、')}…）`}</div>
  </div>`;
  // 身體素質
  const e = eta(v); const rate = weeklyRate(v); const lw = lastWeighIn(v);
  const waist = latestOf(v, 'waist'), bf = latestOf(v, 'bf'), mus = latestOf(v, 'muscle');
  const ph = p.sex === 'F' ? cyclePhase(v, t) : null;
  h += `<div class="card"><h2>身體素質<span class="sub">${lw ? '最後量測 ' + prettyDate(lw.date) : '尚未量體重'}</span></h2>
    ${ph ? `<div class="row" style="margin:-2px 0 8px"><span class="phase">${esc(ph.phase)}${ph.phase === '經期' ? ' 第 ' + ph.day + ' 天' : ph.toNext > 0 ? ' · 約 ' + ph.toNext + ' 天後經期' : ''}</span></div>` : ''}
    <div class="kv">
      <div><b>${r1(tg.w)} kg</b><span>7 日平均體重</span></div>
      <div><b>${rate == null ? '—' : (rate > 0 ? '+' : '') + r1(rate) + ' kg'}</b><span>每週變化（近 3 週）</span></div>
      <div><b>${e.reached ? '已達標' : r1(e.diff) + ' kg'}</b><span>${e.reached ? '可改設新目標或維持' : '距離目標'}</span></div>
      <div><b>${e.reached ? '—' : (e.weeks > 104 ? '> 2 年' : (e.date.getMonth() + 1) + '/' + e.date.getDate())}</b><span>${e.reached ? '預估達標' : '預估達標（' + e.basis + '）'}</span></div>
      <div><b>${waist ? r1(waist.v) + ' cm' : '—'}</b><span>腰圍${waist ? ' · 腰高比 ' + (waist.v / num(p.height)).toFixed(2) : '（每週量一次）'}</span></div>
      <div><b>${bf ? r1(bf.v) + '%' : '—'}</b><span>體脂${mus ? ' · 肌肉 ' + r1(mus.v) + ' kg' : ''}（看趨勢）</span></div>
    </div></div>`;
  // 本週數據＋雙人
  const ba = battingAvg(v); const sk = streak(v); const cw = coupleWeek();
  h += `<div class="card"><h2>本週戰績</h2>
    <div class="grid3 center">
      <div><div class="big">${ba.txt}</div><div class="tiny muted">蛋白質打擊率<br>${ba.hits} 安打 / 7 打數</div></div>
      <div><div class="big">${sk}</div><div class="tiny muted">連續安打<br>（連續記錄天數）</div></div>
      <div><div class="big">${ws.kDays}</div><div class="tiny muted">熱量好球帶<br>（±10% 內天數）</div></div>
    </div>
    ${hasProfile('A') && hasProfile('B') ? `<div class="hr"></div><div class="small"><b>雙人目標</b>（近 7 天合計）</div>
      ${macroRow('蛋白質安打', cw.pHits, cw.pGoal, '#1f2d4d', ' 天', 'min')}${macroRow('訓練', cw.train, cw.trainGoal, '#e0a800', ' 次', 'min')}` : ''}
  </div>`;
  // 週回顧（週日、週一）
  const wd = weekday(t);
  if (wd === 0 || wd === 1) h += weekReviewCard(v, wd === 0 ? t : addDays(t, -1));
  h += `<div class="paws">${pawSVG(14)}${pawSVG(14)}${pawSVG(14)}</div>`;
  return h;
}
function weekReviewCard(v, end) {
  const r = weekReview(v, end);
  return `<div class="card"><h2>本週回顧<span class="sub">${md(addDays(end, -6))}–${md(end)}</span></h2>
    <div class="kv">
      <div><b>${r.logged} / 7</b><span>有記錄天數</span></div>
      <div><b>${r.avgKcal || '—'}</b><span>平均熱量（目標 ${r.tg.kcal}）</span></div>
      <div><b>${r.pDays} / 7</b><span>蛋白質達標</span></div>
      <div><b>${r.train} / ${r.plan}</b><span>訓練次數</span></div>
      <div><b>${r.change == null ? '—' : (r.change > 0 ? '+' : '') + r1(r.change) + ' kg'}</b><span>7 日平均體重變化</span></div>
      <div><b>${r.expected == null ? '—' : (r.expected > 0 ? '−' : '+') + r1(Math.abs(r.expected)) + ' kg'}</b><span>依熱量赤字的預期</span></div>
    </div>
    ${r.change != null && r.expected != null && r.expected > 0.1 && r.change > -r.expected * 0.3 ? '<div class="small muted mt8">實際下降比預期少，常見原因是漏記（醬料、飲料、試吃）或水分波動。再觀察一週。</div>' : ''}
    <div class="note mt12"><b>下週只做一件事：</b>${esc(r.focus)}</div></div>`;
}
function viewWelcome() {
  return `<div class="card center" style="margin-top:20px">
    <div class="row" style="justify-content:center;gap:0">${renderAvatar('A', profile('A').avatar, 0.3).replace('class="av', 'style="width:110px;max-height:240px" class="av')}${renderAvatar('B', profile('B').avatar, 0.3, { expr: 'laugh' }).replace('class="av', 'style="width:110px;max-height:240px" class="av')}</div>
    <div class="row" style="justify-content:center;gap:4px">${catSVG('orange', 'loaf', 40)}${catSVG('tabby', 'loaf', 40)}</div>
    <h2 style="justify-content:center;font-size:18px">減脂 \\Fight/</h2>
    <p class="muted small">每個人用自己的手機選自己的身分。<br>資料會透過你們的 Google 試算表同步。</p>
    <p><b>這支手機是誰在用？</b></p>
    <div class="grid2"><button class="btn pri" data-act="iam" data-uid="A">我是 ${esc(nameOf('A'))}</button><button class="btn gold" data-act="iam" data-uid="B">我是 ${esc(nameOf('B'))}</button></div>
    <p class="tiny muted mt12">若已經架好雲端，可以先設定同步，再回來選身分。</p>
    <button class="btn sm ghost" data-act="tab" data-tab="set">先設定雲端同步</button>
  </div>`;
}

/* ====================== 晨間打卡 ====================== */
function sheetCheckin() {
  const u = me(), t = todayStr(); const dd = daily(u, t); const p = profile(u); const ph = p.sex === 'F' ? cyclePhase(u, t) : null;
  UI.ck = { sleep: dd.sleep || '', bowel: dd.bowel || '', stress: dd.stress || '', alcohol: !!dd.alcohol, period: '' };
  const chipRow = (k, opts) => `<div class="chips" data-ckrow="${k}">${opts.map(o => `<button class="${UI.ck[k] === o[0] ? 'on' : ''}" data-act="ck" data-k="${k}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  openSheet(`<h3>晨間打卡<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    <label class="f">體重 kg ${dd.wsrc === 'health' ? '<span class="chip navy">已從體重機同步</span>' : ''}</label>
    <input type="number" inputmode="decimal" step="0.1" id="ck_w" value="${dd.weight || ''}" placeholder="例如 62.4">
    <label class="f">昨晚睡得</label>${chipRow('sleep', [['bad', '不好'], ['ok', '普通'], ['good', '很好']])}
    <label class="f">早上排便</label>${chipRow('bowel', [['yes', '有'], ['no', '還沒']])}
    <label class="f">最近壓力</label>${chipRow('stress', [['low', '低'], ['mid', '普通'], ['high', '大']])}
    <label class="row small mt12"><input type="checkbox" id="ck_alc" ${UI.ck.alcohol ? 'checked' : ''}> 昨晚有喝酒</label>
    ${p.sex === 'F' ? `<label class="f">經期</label><div class="chips" data-ckrow="period">
      ${ph && ph.inPeriod ? `<button data-act="ck" data-k="period" data-v="end">經期結束了</button><span class="chip">經期第 ${ph.day} 天</span>` : `<button data-act="ck" data-k="period" data-v="start">今天開始</button>${ph ? `<span class="chip">${esc(ph.phase)}${ph.toNext > 0 ? ' · 約 ' + ph.toNext + ' 天後' : ''}</span>` : ''}`}
    </div>` : ''}
    <button class="btn gold block mt12" data-act="saveCheckin">完成打卡</button>
    <div class="tiny muted mt8">建議起床、上完廁所、吃東西前量；每天同樣條件，數字才有意義。</div>`);
}

/* ====================== 飲食 ====================== */
function viewFood() {
  if (!me()) return viewWelcome();
  const u = me(), d = UI.fdate; const ents = foodEntries(u, d); const s = sumFood(ents); const tg = targets(u); const dd = daily(u, d);
  let h = `<div class="datebar"><button class="btn sm" data-act="fdate" data-d="-1">‹</button><b>${prettyDate(d)}</b><button class="btn sm" data-act="fdate" data-d="1" ${d >= todayStr() ? 'disabled' : ''}>›</button></div>`;
  h += `<div class="card"><div class="row"><div class="grow"><b style="font-size:20px">${r0(s.kcal)}</b> <span class="muted">/ ${tg.kcal} kcal</span></div>
     <span class="small">P <b>${r0(s.p)}</b>/${tg.p} · C <b>${r0(s.c)}</b> · F <b>${r0(s.f)}</b>${s.naKnown ? ` · 鈉 <b>${r0(s.na)}</b>` : ''}</span></div>
     <div class="mac"><div class="bar"><i style="width:${clamp(s.kcal / tg.kcal * 100, 0, 100)}%;background:${s.kcal > tg.kcal * 1.05 ? 'var(--warn)' : 'var(--navy)'}"></i></div></div>
     <div class="actions5 mt12">
       <button class="btn" data-act="aiPhoto">${icon('cam')}拍照</button>
       <button class="btn" data-act="aiLabel">${icon('tag')}營養標示</button>
       <button class="btn" data-act="aiText">${icon('txt')}文字描述</button>
       <button class="btn" data-act="lib">${icon('glove')}常用</button>
       <button class="btn" data-act="manual">${icon('pen')}手動</button>
     </div>
     <div class="row mt12"><button class="btn sm ${dd.gameDay ? 'gold' : ''}" data-act="gameDay">⚾ ${dd.gameDay ? '今天是看球日' : '今天去看球'}</button><span class="grow"></span>
     <span class="small muted">喝水 ${r0(num(dd.waterMl))} ml</span><button class="btn sm" data-act="water" data-n="250">+250</button></div>
     ${hasProfile(otherUid(u)) && !recs('food').some(r => r.data.gid) ? `<div class="tiny muted mt8">兩人一起吃？新增食物時勾「和 ${esc(nameOf(otherUid(u)))} 一起吃」，會依比例自動記到兩人帳上。</div>` : ''}</div>`;
  h += '<div class="card flat">';
  MEALS.forEach(m => {
    const list = ents.filter(e => e.data.meal === m); const ms = sumFood(list);
    if (!list.length && (m === '宵夜' || m === '點心')) return;
    h += `<div><div class="meal-h"><b>${m}</b><span class="small muted grow">${list.length ? r0(ms.kcal) + ' kcal · P ' + r0(ms.p) + 'g' : ''}</span>
      <button class="btn sm ghost" data-act="copyMeal" data-meal="${m}">複製昨天</button>
      <button class="btn sm" data-act="lib" data-meal="${m}">＋</button></div>`;
    list.forEach(e => { const x = e.data, q = num(x.qty) || 1;
      h += `<div class="ent" data-act="editFood" data-id="${e.id}"><div class="grow"><div class="nm">${esc(x.name)}${q !== 1 ? ` <span class="muted">×${r1(q)}</span>` : ''}${x.src === 'ai' ? ' <span class="chip">AI</span>' : ''}${x.src === 'label' ? ' <span class="chip">標示</span>' : ''}${x.gid ? ` <span class="chip gold">一起吃${x.by && x.by !== u ? '・' + esc(nameOf(x.by)) + '記' : ''}</span>` : ''}</div>
        <div class="mc">P ${r1(x.p * q)} · C ${r1(x.c * q)} · F ${r1(x.f * q)}${x.na !== '' && x.na != null ? ' · 鈉 ' + r0(x.na * q) : ''}${x.unit ? ' · ' + esc(x.unit) : ''}</div></div><div class="kc">${r0(x.kcal * q)}</div></div>`; });
    if (!list.length) h += '<div class="small muted" style="padding:8px 0">尚未記錄</div>';
    h += '</div>';
  });
  if (!ents.length) h += `<div class="empty">${catSVG('orange', 'loaf', 54)}<div>今天的盤子還是空的</div></div>`;
  h += '</div><p class="tiny muted center">內建食物與 AI 估算皆為約略值，包裝食品請用「營養標示」最準。</p>';
  return h;
}
function splitHTML(on = false) {
  const o = otherUid(me()); if (!hasProfile(o)) return '';
  return `<div class="note mt8"><label class="row small"><input type="checkbox" id="sp_on" ${on ? 'checked' : ''}> 和 ${esc(nameOf(o))} 一起吃（分開記）</label>
    <div class="row mt8"><span class="small">我吃</span><select id="sp_share" style="width:auto">${[30, 40, 50, 60, 70].map(n => `<option value="${n}" ${n === 50 ? 'selected' : ''}>${n}%</option>`).join('')}</select><span class="small muted">其餘記到 ${esc(nameOf(o))}</span></div></div>`;
}
function readSplit() { const c = $('#sp_on'); return c && c.checked ? num($('#sp_share').value) / 100 : 0; }
function libItems() {
  const custom = recs('foodlib').map(r => Object.assign({ id: r.id, custom: true }, r.data));
  const seen = new Set(); const recent = [];
  recs('food', me()).sort((a, b) => b.updatedAt - a.updatedAt).forEach(r => { const k = r.data.name + '|' + r.data.kcal; if (!seen.has(k) && recent.length < 15) { seen.add(k); recent.push(Object.assign({ id: 'r_' + r.id, recent: true }, r.data, { qty: 1 })); } });
  return { recent, custom, builtin: BUILTIN_FOODS };
}
function sheetLib(meal) {
  UI.libMeal = meal || defaultMeal();
  openSheet(`<h3>${icon('glove')} 常用食物<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    <input type="search" id="libQ" placeholder="搜尋（例如：豆漿、雞胸、球場）" autocomplete="off">
    <div class="row mt8"><span class="small muted">加到</span><select id="libMeal" style="width:auto">${MEALS.map(m => `<option ${m === UI.libMeal ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
    <div id="libList"></div>`);
  renderLibList(''); $('#libQ').addEventListener('input', e => renderLibList(e.target.value.trim()));
}
function renderLibList(q) {
  const L = libItems(); const m = x => !q || x.name.includes(q) || (x.tag && x.tag.includes(q));
  const sec = (title, arr) => { const a = arr.filter(m); if (!a.length) return ''; return `<div class="small muted mt12">${title}</div>` + a.map(x => `<div class="lib-item" data-act="libPick" data-src="${x.builtin ? 'b' : x.custom ? 'c' : 'r'}" data-id="${esc(x.id)}"><div class="grow"><div>${esc(x.name)} <span class="muted small">${esc(x.unit || '')}</span>${x.tag ? ` <span class="chip gold">${esc(x.tag)}</span>` : ''}</div><div class="tiny muted">P ${r1(x.p)} · C ${r1(x.c)} · F ${r1(x.f)}${x.na ? ' · 鈉 ' + r0(x.na) : ''}</div></div><b>${r0(x.kcal)}</b></div>`).join(''); };
  $('#libList').innerHTML = (sec('最近吃過', L.recent) + sec('我們的常用', L.custom) + sec('內建（約略值）', L.builtin)) || `<div class="empty">${catSVG('tabby', 'loaf', 46)}<div>找不到，可以用「手動」新增並存成常用。</div></div>`;
}
function findLib(src, id) { const L = libItems(); return (src === 'b' ? L.builtin : src === 'c' ? L.custom : L.recent).find(x => x.id === id); }
function sheetFoodForm(opts) {
  const d = Object.assign({ name: '', unit: '', kcal: '', p: '', c: '', f: '', fib: '', na: '', qty: 1 }, opts.data || {});
  UI.formCtx = opts;
  openSheet(`<h3>${esc(opts.title)}<button class="btn sm ghost x" data-act="closeSheet">取消</button></h3>
    <label class="f">名稱</label><input type="text" id="ff_name" value="${esc(d.name)}" placeholder="例如：雞腿便當">
    <div class="grid2"><div><label class="f">份量說明（選填）</label><input type="text" id="ff_unit" value="${esc(d.unit || '')}" placeholder="1份 / 200g"></div>
    <div><label class="f">吃了幾份</label><div class="row"><button class="btn sm" data-act="qty" data-d="-0.5">−</button><input type="number" id="ff_qty" step="0.25" min="0" value="${r1(num(d.qty) || 1)}" style="text-align:center"><button class="btn sm" data-act="qty" data-d="0.5">＋</button></div></div></div>
    <div class="small muted mt8">以下為「每 1 份」的數值</div>
    <div class="grid3"><div><label class="f">熱量 kcal</label><input type="number" inputmode="decimal" id="ff_kcal" value="${d.kcal}"></div><div><label class="f">蛋白質 g</label><input type="number" inputmode="decimal" id="ff_p" value="${d.p}"></div><div><label class="f">碳水 g</label><input type="number" inputmode="decimal" id="ff_c" value="${d.c}"></div>
    <div><label class="f">脂肪 g</label><input type="number" inputmode="decimal" id="ff_f" value="${d.f}"></div><div><label class="f">纖維 g</label><input type="number" inputmode="decimal" id="ff_fib" value="${d.fib}"></div><div><label class="f">鈉 mg</label><input type="number" inputmode="decimal" id="ff_na" value="${d.na ?? ''}"></div></div>
    <label class="f">餐別</label><select id="ff_meal">${MEALS.map(m => `<option ${m === (opts.meal || d.meal || defaultMeal()) ? 'selected' : ''}>${m}</option>`).join('')}</select>
    <div class="small muted mt8" id="ff_chk"></div>
    ${opts.id && opts.data.gid ? '<div class="tiny muted mt8">這筆是「一起吃」分開記的其中一份。</div>' : splitHTML()}
    <label class="row small mt8"><input type="checkbox" id="ff_lib" ${opts.saveLib ? 'checked' : ''}> 存到「我們的常用」</label>
    <div class="grid2 mt12">${opts.id ? '<button class="btn danger" data-act="delFood">刪除</button>' : '<span></span>'}<button class="btn pri" data-act="saveFood">${opts.id ? '儲存' : '加入'}</button></div>`);
  const chk = () => { const k = num($('#ff_kcal').value), m = num($('#ff_p').value) * 4 + num($('#ff_c').value) * 4 + num($('#ff_f').value) * 9;
    $('#ff_chk').textContent = k && m && Math.abs(m - k) / k > 0.2 ? `提醒：三大營養素換算約 ${r0(m)} kcal，和填寫的熱量差距較大（含酒精或糖醇時正常）。` : ''; };
  ['ff_kcal', 'ff_p', 'ff_c', 'ff_f'].forEach(i => $('#' + i).addEventListener('input', chk)); chk();
}
function readFoodForm() {
  const v = i => $('#ff_' + i).value;
  return { name: v('name').trim() || '未命名', unit: v('unit').trim(), qty: num(v('qty')) || 1, kcal: num(v('kcal')), p: num(v('p')), c: num(v('c')), f: num(v('f')), fib: num(v('fib')), na: v('na') === '' ? '' : num(v('na')), meal: v('meal') };
}

/* ---------- AI（照片 / 文字 / 營養標示 / 體組成報告） ---------- */
const AI_TITLE = { photo: '拍照辨識', text: '文字描述辨識', label: '營養標示', body: '體組成報告' };
function sheetAI(mode) {
  UI.ai = { mode, img: null, items: null, label: null, body: null, note: '', meal: defaultMeal(), busy: false, err: '', date: todayStr() };
  renderAISheet();
  if (mode !== 'text' && S.cfg.apiUrl) { const i = $('#aiFile'); if (i) i.click(); }
}
function renderAISheet() {
  const a = UI.ai; const noApi = !S.cfg.apiUrl; const img = a.mode !== 'text';
  let h = `<h3>${AI_TITLE[a.mode]}<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>`;
  if (noApi) h += '<div class="note">AI 功能需要先完成雲端設定（設定 → 雲端同步）。AI 金鑰放在你們自己的 Apps Script，不會出現在網頁上。</div>';
  if (a.mode === 'label') h += '<div class="small muted">拍包裝背面的「營養標示」表格，盡量拍正、拍清楚。</div>';
  if (a.mode === 'body') h += '<div class="small muted">在 bpt care 的完整報告頁截圖後上傳，會自動讀出所有數字。偶爾（例如每 2～4 週）上傳一次就夠了，平常的體重會自動同步。</div>';
  if (img) h += `<input type="file" id="aiFile" accept="image/*" style="display:none">${a.img ? `<img class="photo-prev" src="data:image/jpeg;base64,${a.img}">` : ''}<button class="btn block mt8" data-act="aiPick">${a.img ? '換一張' : (a.mode === 'body' ? '選擇截圖' : '選擇或拍攝照片')}</button>`;
  if (a.mode === 'photo' || a.mode === 'text') h += `<label class="f">${a.mode === 'photo' ? '補充說明（選填，會更準）' : '吃了什麼？'}</label>
    <textarea id="aiHint" placeholder="${a.mode === 'photo' ? '例如：飯只吃一半、醬另外放、飲料是無糖' : '例如：7-11 雞胸肉一包、茶葉蛋兩顆、無糖豆漿一瓶'}">${esc(a.hint || '')}</textarea>`;
  h += `<div class="row mt8">${a.mode === 'body' ? '' : `<span class="small muted">餐別</span><select id="aiMeal" style="width:auto">${MEALS.map(m => `<option ${m === a.meal ? 'selected' : ''}>${m}</option>`).join('')}</select>`}
    <button class="btn pri grow" data-act="aiRun" ${a.busy || noApi ? 'disabled' : ''}>${a.busy ? '<span class="spinner"></span> 分析中，約 10～30 秒…' : '分析'}</button></div>`;
  if (a.err) h += `<div class="note mt8">${esc(a.err)}</div>`;
  if (a.items) {
    h += `<div class="hr"></div><div class="small muted">AI 估算結果，請檢查份量（改克數會自動換算）：</div>`;
    a.items.forEach((it, i) => {
      h += `<div class="ai-item ${it.on ? '' : 'off'}"><div class="row"><input type="checkbox" data-chg="aiOn" data-i="${i}" ${it.on ? 'checked' : ''}><input type="text" data-inp="aiName" data-i="${i}" value="${esc(it.name)}" style="padding:4px 8px"><span class="chip">${esc(it.confidence || '')}</span></div>
        <div class="g"><div><input type="number" inputmode="decimal" data-inp="aiG" data-i="${i}" value="${r0(it.grams)}"><span>克</span></div>
        ${[['kcal', 'kcal'], ['p', '蛋白'], ['c', '碳水'], ['f', '脂肪'], ['na', '鈉mg']].map(([k, l]) => `<div><input type="number" inputmode="decimal" data-inp="aiV" data-k="${k}" data-i="${i}" value="${k === 'kcal' || k === 'na' ? r0(it[k]) : r1(it[k])}"><span>${l}</span></div>`).join('')}</div></div>`;
    });
    if (a.note) h += `<div class="small muted">${esc(a.note)}</div>`;
    h += `<div class="small mt12">合計 <b id="aiTot"></b></div>${splitHTML()}<label class="row small mt8"><input type="checkbox" id="aiLib"> 同時存到「我們的常用」</label>
      <button class="btn pri block mt12" data-act="aiSave">加入${esc(a.meal)}</button>`;
  }
  if (a.label) {
    const L = a.label;
    h += `<div class="hr"></div><label class="f">名稱</label><input type="text" id="lb_name" value="${esc(L.name)}">
      <div class="small muted mt8">每一份（${esc(L.servingDesc || '—')}）${L.servings ? `，本包裝含 ${L.servings} 份` : ''}</div>
      <div class="grid3">${[['kcal', '熱量'], ['protein', '蛋白質 g'], ['carbs', '碳水 g'], ['fat', '脂肪 g'], ['fiber', '纖維 g'], ['sodium', '鈉 mg']].map(([k, l]) => `<div><label class="f">${l}</label><input type="number" inputmode="decimal" id="lb_${k}" value="${L[k]}"></div>`).join('')}</div>
      <label class="f">吃了幾份</label><div class="row"><input type="number" id="lb_qty" step="0.25" value="1" style="width:90px;text-align:center">
      ${L.servings > 1 ? `<button class="btn sm" data-act="lbQty" data-v="${L.servings}">整包（${L.servings} 份）</button>` : ''}<button class="btn sm" data-act="lbQty" data-v="0.5">半份</button></div>
      ${splitHTML()}<label class="row small mt8"><input type="checkbox" id="aiLib" checked> 存到「我們的常用」（下次直接選）</label>
      <button class="btn pri block mt12" data-act="lbSave">加入${esc(a.meal)}</button>`;
  }
  if (a.body) {
    const B = a.body;
    h += `<div class="hr"></div><div class="small muted">請確認數字，不對可以直接改：</div><div class="grid3">${BODY_FIELDS.map(([k, l]) => `<div><label class="f">${l}</label><input type="number" inputmode="decimal" id="bd_${k}" value="${B[k] || ''}"></div>`).join('')}</div>
      <label class="f">量測日期</label><input type="date" id="bd_date" value="${a.date}" max="${todayStr()}">
      <button class="btn pri block mt12" data-act="bdSave">儲存到身體紀錄</button>`;
  }
  openSheet(h);
  const fi = $('#aiFile'); if (fi) fi.addEventListener('change', onAIFile);
  if (a.items) aiTotals();
}
const BODY_FIELDS = [['weight', '體重 kg'], ['bf', '體脂率 %'], ['muscle', '肌肉量 kg'], ['smm', '骨骼肌 kg'], ['water', '水分 %'], ['visceral', '內臟脂肪'], ['bone', '骨量 kg'], ['protein', '蛋白質 %'], ['bmrS', '基礎代謝'], ['bodyAge', '身體年齡']];

/* ====================== 運動 ====================== */
function viewGym() {
  if (!me()) return viewWelcome();
  const u = me(), d = UI.wdate; const s = session(u, d); const p = profile(u); const nt = nextTpl(u);
  let h = `<div class="datebar"><button class="btn sm" data-act="wdate" data-d="-1">‹</button><b>${prettyDate(d)}</b><button class="btn sm" data-act="wdate" data-d="1" ${d >= todayStr() ? 'disabled' : ''}>›</button></div>`;
  const tn = s && s.tpl && getTpl(s.tpl) ? getTpl(s.tpl).name : '';
  h += '<div class="card"><h2>重量訓練' + (tn ? `<span class="chip navy">${esc(tn)}</span>` : '') + (s && s.finished ? '<span class="chip gold">已完成</span>' : '') + '</h2>';
  if (!s || !(s.exercises || []).length) {
    h += `<p class="small muted" style="margin-top:0">今天的先發是 <b>${TPL[nt].name}</b>，會自動帶入上次的重量。</p>` + tplPicker(p, nt, 'startTpl');
  } else if (s.finished) {
    const st = sessionStats(u, d);
    h += `<div class="small">${s.exercises.filter(e => e.sets.some(x => x.done)).map(e => `<b>${esc(e.name)}</b>　${e.sets.filter(x => x.done).map(x => (exUnit(e.name) === 'sec' ? '' : r1(x.kg) + '×') + r0(x.reps) + (exUnit(e.name) === 'sec' ? '秒' : '')).join('、')}`).join('<br>') || '沒有完成的組數'}</div>
      <div class="kv mt12"><div><b>${st.sets}</b><span>完成組數</span></div><div><b>${r0(st.vol).toLocaleString()} kg</b><span>總訓練量</span></div></div>
      <div class="grid2 mt12"><button class="btn" data-act="reopenSession">繼續訓練</button><button class="btn" data-act="saveTplSheet">存成我的菜單</button></div>`;
  } else {
    s.exercises.forEach((e, ei) => {
      const unit = exUnit(e.name); const last = lastExercise(u, e.name, d); const [lo, hi] = tplRange(s.tpl, e.name);
      let hint = '';
      if (last && unit !== 'sec') { const ds = last.ex.sets.filter(x => x.done); if (ds.length && ds.every(x => num(x.reps) >= hi)) hint = `上次每組都做到 ${hi} 下，這次可以加重（大肌群 +2.5kg、啞鈴 +1～2kg）。`; }
      h += `<div class="ex"><div class="ex-h"><b>${esc(e.name)}</b><span class="tiny muted">${lo}-${hi}${unit === 'sec' ? '秒' : '下'}</span><button class="btn sm ghost" data-act="exMenu" data-ei="${ei}">⋯</button></div>
        <div class="last">${last ? '上次 ' + prettyDate(last.date) + '：' + last.ex.sets.filter(x => x.done).map(x => (unit === 'sec' ? '' : r1(x.kg) + '×') + r0(x.reps) + (unit === 'sec' ? '秒' : '')).join('、') : '第一次做這個動作，先用能標準完成的重量。'}</div>
        ${hint ? `<div class="hint">${hint}</div>` : ''}
        <table class="sets"><tr><th></th><th>${unit === 'sec' ? '負重 kg' : '重量 kg'}</th><th>${unit === 'sec' ? '秒數' : '次數'}</th><th>完成</th></tr>`;
      e.sets.forEach((st, si) => {
        h += `<tr class="${st.done ? 'done' : ''}"><td class="n">${si + 1}</td>
          <td><input type="number" inputmode="decimal" step="0.5" data-chg="set" data-ei="${ei}" data-si="${si}" data-k="kg" value="${st.kg === '' || st.kg == null ? '' : st.kg}" placeholder="0"></td>
          <td><input type="number" inputmode="numeric" data-chg="set" data-ei="${ei}" data-si="${si}" data-k="reps" value="${st.reps === '' || st.reps == null ? '' : st.reps}" placeholder="${lo}"></td>
          <td><button class="ck ${st.done ? 'on' : ''}" data-act="setDone" data-ei="${ei}" data-si="${si}">✓</button></td></tr>`;
      });
      h += `</table><div class="row mt8"><button class="btn sm" data-act="addSet" data-ei="${ei}">＋ 一組</button>${e.sets.length > 1 ? `<button class="btn sm ghost" data-act="delSet" data-ei="${ei}">− 刪最後一組</button>` : ''}</div></div>`;
    });
    h += `<button class="btn block" data-act="addEx">＋ 新增動作</button>
      <div class="grid2 mt8"><button class="btn" data-act="changeTpl">換菜單</button><button class="btn" data-act="saveTplSheet">存成我的菜單</button></div>
      <button class="btn gold block mt8" data-act="finishSession">完成今天的訓練</button>`;
  }
  h += '</div>';
  // 對方今天
  const o = otherUid(u); const os = session(o, d);
  if (hasProfile(o) && os && ((os.exercises || []).length || (os.cardio || []).length)) {
    const ost = sessionStats(o, d);
    h += `<div class="card"><h2>${esc(nameOf(o))} ${d === todayStr() ? '今天' : prettyDate(d)}的訓練<span class="sub">${ost.sets} 組 · 有氧 ${ost.cardioMin} 分</span></h2>
      <div class="small">${(os.exercises || []).map(e => `${esc(e.name)}：${e.sets.filter(x => x.done).map(x => (exUnit(e.name) === 'sec' ? '' : r1(x.kg) + '×') + r0(x.reps)).join('、') || '—'}`).join('<br>')}</div></div>`;
  }
  // 有氧
  const kg = trendWeight(u);
  h += '<div class="card"><h2>有氧</h2>';
  ((s && s.cardio) || []).forEach((c, ci) => {
    h += `<div class="ent" data-act="editCardio" data-ci="${ci}"><div class="grow"><div class="nm">${CARDIO[c.kind] || c.kind} · ${r0(c.min)} 分鐘</div>
      <div class="mc">${num(c.speed) ? '速度 ' + r1(c.speed) + ' km/h · ' : ''}${num(c.incline) ? '坡度 ' + r1(c.incline) + '% · ' : ''}${num(c.hr) ? '心率 ' + r0(c.hr) : ''}</div></div><div class="kc">${r0(cardioKcal(c, kg))} kcal</div></div>`;
  });
  h += `<button class="btn block mt8" data-act="addCardio">＋ 新增有氧</button>
    <div class="row mt12"><span class="small grow">今日步數</span><input type="number" inputmode="numeric" data-chg="steps" value="${num(daily(u, d).steps) || ''}" placeholder="例如 8000" style="width:130px;text-align:right"></div>
    <div class="tiny muted mt8">有氧熱量為淨消耗估算（ACSM 公式／MET），手錶數字通常偏高；兩者都不建議「吃回來」。</div></div>`;
  h += `<div class="card"><details class="plan"><summary>⚾ 我的先發輪值（每週 ${num(p.trainDays)} 次）▾</summary>${planHTML(p)}</details></div>`;
  const names = [...new Set(sessionsOf(u).flatMap(r => (r.data.exercises || []).filter(e => exUnit(e.name) !== 'sec' && e.sets.some(x => x.done)).map(e => e.name)))];
  if (names.length) {
    if (!names.includes(UI.progEx)) UI.progEx = names[0];
    const pts = sessionsOf(u).slice().reverse().map(r => { const e = (r.data.exercises || []).find(x => x.name === UI.progEx); if (!e) return null; const best = Math.max(0, ...e.sets.filter(x => x.done).map(x => e1rm(x.kg, x.reps))); return best ? { x: dayNum(r.date), y: r1(best) } : null; }).filter(Boolean);
    h += `<div class="card"><h2>力量進步<span class="sub">估算 1RM（kg）</span></h2><select data-chg="progEx">${names.map(n => `<option ${n === UI.progEx ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="mt8">${lineChart([{ pts, color: '#1f2d4d', line: true, dots: true }], { h: 140, minPad: 2 })}</div></div>`;
  }
  const hist = sessionsOf(u).filter(r => r.date !== d).slice(0, 8);
  if (hist.length) {
    h += '<div class="card"><h2>最近訓練</h2>';
    hist.forEach(r => { const st = sessionStats(u, r.date); h += `<div class="ent" data-act="gotoW" data-d="${r.date}"><div class="grow"><div class="nm">${prettyDate(r.date)}${r.data.tpl && getTpl(r.data.tpl) ? ' · ' + esc(getTpl(r.data.tpl).name) : ''}</div><div class="mc">${st.exN} 個動作 · ${st.sets} 組 · 總量 ${r0(st.vol).toLocaleString()} kg${st.cardioMin ? ' · 有氧 ' + st.cardioMin + ' 分' : ''}</div></div><span class="muted">›</span></div>`; });
    h += '</div>';
  }
  return h;
}
function tplPicker(p, nt, act) {
  const rot = [...new Set(ROTATION[clamp(num(p.trainDays) || 3, 1, 6)])]; const cts = customTpls();
  let h = '<div class="small muted">先發輪值</div><div class="row rwrap mt8">';
  rot.forEach(k => { h += `<button class="btn ${k === nt ? 'pri' : ''}" data-act="${act}" data-tpl="${k}">${TPL[k].name}</button>`; });
  h += '</div>';
  if (cts.length) { h += '<div class="small muted mt12">我們的菜單</div><div class="row rwrap mt8">'; cts.forEach(t => { h += `<button class="btn" data-act="${act}" data-tpl="${t.key}">${esc(t.name)}</button>`; }); h += '</div>'; }
  if (act === 'startTpl') h += '<button class="btn block mt12" data-act="addEx">空白，自己加動作</button>';
  return h;
}
function planHTML(p) {
  const n = clamp(num(p.trainDays) || 3, 1, 6); const rot = [...new Set(ROTATION[n])];
  let h = `<div class="small mt8">${n <= 3 ? `每週 ${n} 次全身訓練，A／B 輪流（例如一三五）。` : `每週 ${n} 次上下肢分開，上肢 1 → 下肢 1 → 上肢 2 → 下肢 2 輪流${n > 4 ? '，多出的天數做有氧或休息' : ''}。`}</div>`;
  rot.forEach(k => { h += `<div class="tpl"><b>${TPL[k].name}</b>${TPL[k].ex.map(e => `${e[0]} ${e[1]}×${e[2]}${exUnit(e[0]) === 'sec' ? '秒' : ''}`).join('<br>')}</div>`; });
  const cts = customTpls();
  h += `<div class="small mt12"><b>我們的菜單</b>${cts.length ? '' : '：還沒有。用「空白，自己加動作」排好動作，再按「存成我的菜單」就會出現在這裡，兩人都看得到。'}</div>`;
  cts.forEach(t => { h += `<div class="tpl"><div class="row"><b class="grow">${esc(t.name)}</b><span class="tiny muted">${esc(nameOf(t.uid))} 建立</span><button class="btn sm ghost danger" data-act="delTpl" data-id="${t.key}">刪除</button></div>${t.ex.map(e => `${esc(e[0])} ${e[1]}×${esc(e[2])}`).join('<br>')}</div>`; });
  h += `<div class="small"><b>進步規則</b>：每組都做到次數上限、動作仍標準 → 下次加重；做不到下限 → 維持重量。每組保留 1～2 下的餘力。<br>
  <b>組間休息</b>：大動作 2 分鐘、小動作 60～90 秒。<br>
  <b>有氧</b>：每週 2～3 次、20～40 分鐘坡度走（速度 4.5～5.5、坡度 6～12%），強度是「能說話但不能唱歌」。<br>
  <b>日常活動</b>：每天 7,000～10,000 步。<br>
  <b>經期</b>：經期前後體力較差時可以減少組數，不必硬撐；濾泡期（經期後一週）通常最適合挑戰重量。<br>
  <b>關鍵順序</b>：蛋白質達標 → 重訓漸進 → 熱量赤字 → 睡眠 7 小時以上。</div>`;
  return h;
}
function sheetAddEx() {
  openSheet(`<h3>新增動作<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3><input type="search" id="exQ" placeholder="搜尋或輸入自訂動作名稱"><div id="exList"></div>`);
  const draw = q => { const parts = [...new Set(EX_LIB.map(e => e.part))]; let h = '';
    if (q && !EX_LIB.some(e => e.name === q)) h += `<div class="lib-item" data-act="exPick" data-n="${esc(q)}"><b>＋ 新增「${esc(q)}」</b></div>`;
    parts.forEach(pt => { const a = EX_LIB.filter(e => e.part === pt && (!q || e.name.includes(q))); if (!a.length) return; h += `<div class="small muted mt12">${pt}</div>` + a.map(e => `<div class="lib-item" data-act="exPick" data-n="${esc(e.name)}">${esc(e.name)}</div>`).join(''); });
    $('#exList').innerHTML = h; };
  draw(''); $('#exQ').addEventListener('input', e => draw(e.target.value.trim()));
}
function sheetCardio(ci) {
  const s = curSession(); const c = ci != null ? s.cardio[ci] : { kind: 'treadmill', min: 30, speed: 5, incline: 8, hr: '', kcalManual: '' };
  UI.cardioIdx = ci;
  openSheet(`<h3>${ci != null ? '編輯' : '新增'}有氧<button class="btn sm ghost x" data-act="closeSheet">取消</button></h3>
    <label class="f">類型</label><select id="cd_kind">${Object.entries(CARDIO).map(([k, v]) => `<option value="${k}" ${k === c.kind ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <div class="grid2"><div><label class="f">時間（分鐘）</label><input type="number" inputmode="decimal" id="cd_min" value="${c.min}"></div>
    <div><label class="f">平均心率（選填）</label><input type="number" inputmode="numeric" id="cd_hr" value="${c.hr || ''}"></div>
    <div><label class="f">速度 km/h</label><input type="number" inputmode="decimal" step="0.1" id="cd_speed" value="${c.speed || ''}"></div>
    <div><label class="f">坡度 %</label><input type="number" inputmode="decimal" step="0.5" id="cd_incline" value="${c.incline || ''}"></div></div>
    <label class="f">手動熱量（選填，填了就用這個）</label><input type="number" inputmode="numeric" id="cd_kcal" value="${c.kcalManual || ''}">
    <div class="small muted mt8" id="cd_est"></div>
    <div class="grid2 mt12">${ci != null ? '<button class="btn danger" data-act="delCardio">刪除</button>' : '<span></span>'}<button class="btn pri" data-act="saveCardio">儲存</button></div>`);
  const est = () => { $('#cd_est').textContent = `估算淨消耗約 ${r0(cardioKcal(readCardio(), trendWeight(me())))} kcal`; };
  $$('#sheetBody input, #sheetBody select').forEach(i => i.addEventListener('input', est)); est();
}
function readCardio() { const v = i => $('#cd_' + i).value; return { kind: v('kind'), min: num(v('min')), speed: num(v('speed')), incline: num(v('incline')), hr: num(v('hr')), kcalManual: num(v('kcal')) }; }

/* ====================== 身體 ====================== */
function viewBody() {
  if (!me()) return viewWelcome();
  const v = viewUid(); const mine = v === me(); const p = profile(v); const t = todayStr();
  let h = `<div class="seg mt12">${UIDS.map(u => `<button class="${u === v ? 'on' : ''}" data-act="pickView" data-uid="${u}">${esc(nameOf(u))}${u === me() ? '（我）' : ''}</button>`).join('')}</div>`;
  if (!hasProfile(v)) return h + `<div class="card"><div class="empty">${catSVG('tabby', 'loaf', 54)}<div>尚未設定個人資料</div></div></div>`;
  if (mine) {
    const td = daily(v, t);
    h += `<div class="card"><h2>今天的量測<span class="sub">${td.wsrc === 'health' ? '體重已從體重機同步' : '起床、廁所後、吃東西前'}</span></h2>
      <div class="grid2"><div><label class="f">體重 kg</label><input type="number" inputmode="decimal" step="0.1" id="b_weight" value="${td.weight || ''}"></div>
      <div><label class="f">體脂 %</label><input type="number" inputmode="decimal" step="0.1" id="b_bf" value="${td.bf || ''}"></div>
      <div><label class="f">腰圍 cm（每週）</label><input type="number" inputmode="decimal" step="0.5" id="b_waist" value="${td.waist || ''}"></div>
      <div><label class="f">臀圍 cm（每週）</label><input type="number" inputmode="decimal" step="0.5" id="b_hip" value="${td.hip || ''}"></div></div>
      <button class="btn pri block mt12" data-act="saveBody">儲存</button>
      <div class="grid2 mt8"><button class="btn" data-act="checkin">晨間打卡</button><button class="btn" data-act="aiBody">${icon('scale')} 上傳 bpt care 報告</button></div>
      <div class="tiny muted mt8">腰圍量肚臍高度、吐氣後。增肌減脂時體重可能變化不大，腰圍和照片更能反映進度。</div></div>`;
  }
  // 體組成
  const comp = BODY_FIELDS.filter(([k]) => k !== 'weight').map(([k, l]) => ({ k, l, x: latestOf(v, k) })).filter(o => o.x);
  if (comp.length) h += `<div class="card"><h2>身體組成<span class="sub">最新一次</span></h2><div class="kv">${comp.slice(0, 8).map(o => `<div><b>${r1(o.x.v)}</b><span>${o.l} · ${md(o.x.date)}</span></div>`).join('')}</div>
    <div class="tiny muted mt8">家用體脂計會受水分影響，單次差 2～3% 很常見。看 2～4 週的方向就好。</div></div>`;
  // 體重圖（經期區段標示）
  const from = dayNum(t) - UI.bodyRange;
  const ws = weights(v).filter(w => w.x > from); const tr = trendSeries(v).filter(w => w.x > from);
  const bands = p.sex === 'F' ? cycles(v).map(c => ({ x0: dayNum(c.start), x1: dayNum(c.end || addDays(c.start, (num(p.periodLen) || 5) - 1)) + 1, color: '#d97a8f' })).filter(b => b.x1 > from) : [];
  h += `<div class="card"><h2>體重趨勢<span class="sub"><span style="color:${colorOf(v)}">━</span> 7 日平均　● 每日${bands.length ? '　<span style="color:#d97a8f">■</span> 經期' : ''}</span></h2>
    <div class="seg" style="margin-bottom:8px">${[30, 90, 365].map(n => `<button class="${UI.bodyRange === n ? 'on' : ''}" data-act="bodyRange" data-n="${n}">${n === 365 ? '1 年' : n + ' 天'}</button>`).join('')}</div>
    ${lineChart([{ pts: ws, color: '#b9b2a6', dots: true, op: 0.8 }, { pts: tr, color: colorOf(v), line: true }], { goal: num(p.goalWeight), h: 160, bands })}</div>`;
  // 經期
  if (p.sex === 'F') {
    const ph = cyclePhase(v, t); const cs = cycles(v).slice(-4).reverse();
    h += `<div class="card"><h2>經期<span class="sub">平均週期 ${cycleLen(v)} 天</span></h2>
      ${ph ? `<div><span class="phase">${esc(ph.phase)}${ph.phase === '經期' ? ' 第 ' + ph.day + ' 天' : ''}</span> <span class="small muted">預估下次 ${md(ph.next)}${ph.toNext > 0 ? '（約 ' + ph.toNext + ' 天後）' : ''}</span></div><div class="small mt8">${esc(PHASE_NOTE[ph.phase] || '')}</div>` : '<div class="small muted">記錄經期開始日後，體重解讀會把經期的水分變化算進去。</div>'}
      ${mine ? `<div class="row mt12">${ph && ph.inPeriod && !ph.last.end ? '<button class="btn" data-act="periodEnd">經期結束了</button>' : '<button class="btn" data-act="periodStart">今天經期開始</button>'}<button class="btn ghost sm" data-act="periodPast">補記過去日期</button></div>` : ''}
      ${cs.length ? `<div class="small muted mt12">${cs.map(c => `${md(c.start)}${c.end ? '–' + md(c.end) : ''}`).join('　')}</div>` : ''}</div>`;
  }
  // 體態照片
  h += photoCard(v, mine);
  // 月報
  h += monthCard(v);
  // 熱量算法
  const tg = targets(v); const ad = adaptiveTdee(v);
  h += `<div class="card"><h2>熱量怎麼算的</h2><div class="small">
    基礎代謝 BMR（Mifflin-St Jeor）<b style="float:right">${r0(tg.bmr)} kcal</b><br>
    × 生活活動係數 ${p.life}<b style="float:right">${r0(tg.bmr * p.life)} kcal</b><br>
    ＋ 訓練平均（每週 ${p.trainDays} 次 × 300 ÷ 7）<b style="float:right">${r0(tg.trainAllow)} kcal</b><br>
    ＝ 估算 TDEE<b style="float:right">${r0(tg.est)} kcal</b><br>
    ${num(p.tdeeOverride) > 0 ? `<span style="color:var(--navy);font-weight:700">目前使用實測 TDEE</span><b style="float:right">${r0(p.tdeeOverride)} kcal</b><br>` : ''}
    − 赤字（每週 ${p.pace} kg）<b style="float:right">${r0(tg.deficit)} kcal</b>
    <div class="hr"></div>每日目標<b style="float:right">${tg.kcal} kcal</b><br>
    三大營養素：${MACRO_PRESETS[tg.macroMode].name}（蛋白質 ${r0(tg.p * 400 / tg.kcal)}%／碳水 ${r0(tg.c * 400 / tg.kcal)}%／脂肪 ${r0(tg.f * 900 / tg.kcal)}%）<br>
    蛋白質 ${tg.p}g（${r1(tg.p / tg.refW)} g/kg）· 脂肪 ${tg.f}g · 碳水 ${tg.c}g · 纖維 ${tg.fib}g · 鈉 < ${tg.na}mg · 水 ${tg.water}ml</div>
    ${tg.notes.map(n => `<div class="tiny muted mt8">・${esc(n)}</div>`).join('')}
    <div class="hr"></div><div class="small"><b>實測 TDEE</b>（用實際記錄反推，最準）<br>
    ${ad.ok ? `近 28 天平均攝取 ${ad.avg} kcal、體重每週 ${r1(ad.rate)} kg → 實際 TDEE 約 <b>${ad.est} kcal</b>
      ${mine ? `<div class="row mt8"><button class="btn sm pri" data-act="applyTdee" data-v="${ad.est}">套用這個數字</button>${num(p.tdeeOverride) > 0 ? '<button class="btn sm" data-act="applyTdee" data-v="0">改回公式估算</button>' : ''}</div>` : ''}`
      : `<span class="muted">需要近 28 天內至少 14 天完整飲食記錄、8 次體重（目前 ${ad.days} 天、${ad.weighs} 次）。公式估算常有 ±10～15% 誤差，累積資料後這裡會算出真實數字。</span>`}</div></div>`;
  const hist = recs('daily', v).filter(r => num(r.data.weight) || num(r.data.waist) || num(r.data.bf)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  if (hist.length) h += `<div class="card"><h2>量測紀錄</h2>${hist.map(r => `<div class="ent" style="cursor:default"><div class="grow">${prettyDate(r.date)}${r.data.wsrc === 'health' ? ' <span class="chip navy">體重機</span>' : r.data.wsrc === 'scan' ? ' <span class="chip">報告</span>' : ''}</div><div class="small">${num(r.data.weight) ? r1(r.data.weight) + ' kg' : ''}${num(r.data.waist) ? ' · 腰 ' + r1(r.data.waist) : ''}${num(r.data.bf) ? ' · ' + r1(r.data.bf) + '%' : ''}</div></div>`).join('')}</div>`;
  return h;
}
function photoCard(v, mine) {
  const ph = recs('photo', v); const P = UI.photo;
  const dates = [...new Set(ph.filter(r => r.data.pose === P.pose).map(r => r.date))].sort();
  if (dates.length && (!dates.includes(P.a) || !dates.includes(P.b) || P.uid !== v || (P.a === P.b && dates.length > 1 && !P.manual))) { P.a = dates[0]; P.b = dates[dates.length - 1]; P.uid = v; }
  let h = `<div class="card"><h2>${icon('photo')} 體態照片<span class="sub">建議每 2 週、同地點同光線</span></h2>
    <div class="seg">${[['front', '正面'], ['side', '側面']].map(([k, l]) => `<button class="${P.pose === k ? 'on' : ''}" data-act="photoPose" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (mine) h += `<input type="file" id="phFile" accept="image/*" style="display:none"><button class="btn block mt8" data-act="photoAdd">＋ 拍今天的${P.pose === 'front' ? '正面' : '側面'}</button>`;
  if (!S.cfg.apiUrl) h += '<div class="small muted mt8">體態照片存在你們的 Google 雲端硬碟，需要先完成雲端設定。</div>';
  if (dates.length >= 1) {
    h += `<div class="small muted mt12">選兩個日期比較（左右滑動）</div>
      <div class="row mt8"><select data-chg="phA" style="width:auto">${dates.map(d => `<option ${d === P.a ? 'selected' : ''}>${d}</option>`).join('')}</select><span class="muted">vs</span>
      <select data-chg="phB" style="width:auto">${dates.map(d => `<option ${d === P.b ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
      <div class="cmp mt8" id="cmpBox"><div class="empty" style="position:absolute;inset:0;justify-content:center">${catSVG('orange', 'loaf', 46)}<div>照片載入中…</div></div></div>
      <input type="range" min="0" max="100" value="${P.pos}" data-inp="phPos" style="width:100%">`;
  } else h += `<div class="empty">${catSVG('orange', 'sit', 44)}<div>還沒有照片。第一張就是你們的起點。</div></div>`;
  return h + '</div>';
}
function monthCard(v) {
  const months = []; const d = new Date(); for (let i = 0; i < 6; i++) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); months.push(x.getFullYear() + '-' + z2(x.getMonth() + 1)); }
  const r = monthReport(v, UI.month);
  let h = `<div class="card"><h2>月報<span class="sub"><select data-chg="month" style="width:auto;padding:3px 6px;font-size:13px">${months.map(m => `<option value="${m}" ${m === UI.month ? 'selected' : ''}>${m.replace('-', ' 年 ')} 月</option>`).join('')}</select></span></h2>`;
  if (!r || (!r.loggedDays && !r.nW)) return h + `<div class="empty">${catSVG('tabby', 'loaf', 46)}<div>這個月還沒有資料</div></div></div>`;
  const dl = (a, b, unit, dec = 1) => a == null || b == null ? '—' : `${dec ? r1(a) : r0(a)} → ${dec ? r1(b) : r0(b)} ${unit}（${b - a > 0 ? '+' : ''}${r1(b - a)}）`;
  h += `<div class="small" style="line-height:1.9">
    體重（月初 vs 月底平均）：<b>${dl(r.firstW, r.lastW, 'kg')}</b><br>
    腰圍：<b>${r.waist ? dl(r.waist.first, r.waist.last, 'cm') : '—'}</b>　體脂：<b>${r.bf ? dl(r.bf.first, r.bf.last, '%') : '—'}</b><br>
    ${r.muscle ? `肌肉量：<b>${dl(r.muscle.first, r.muscle.last, 'kg')}</b><br>` : ''}
    有記錄 <b>${r.loggedDays}</b> / ${r.totalDays} 天 · 平均 <b>${r.avgKcal}</b> kcal · 蛋白質 <b>${r.avgP}</b> g（達標 ${r.pHit} 天）<br>
    訓練 <b>${r.trainN}</b> 次 · 有氧 <b>${r.cardio}</b> 分鐘</div>
    ${r.lifts.length ? `<div class="small mt8"><b>力量進步</b><br>${r.lifts.map(l => `${esc(l.name)}：${r1(l.first)} → ${r1(l.last)} kg（${l.gain >= 0 ? '+' : ''}${r1(l.gain)}）`).join('<br>')}</div>` : ''}
    ${r.photos.length >= 2 ? `<div class="small muted mt8">這個月有 ${r.photos.length} 張體態照片，可以在上面選 ${r.photos[0].date} 和 ${r.photos[r.photos.length - 1].date} 比較。</div>` : ''}`;
  return h + '</div>';
}

/* ====================== 設定 ====================== */
function viewSet() {
  const eu = UI.editUid || me() || 'A';
  if (!UI.draft || UI.draft.uid !== eu) UI.draft = { uid: eu, p: JSON.parse(JSON.stringify(profile(eu))) };
  const p = UI.draft.p; const av = p.avatar;
  const lifeOpts = [[1.2, '久坐（辦公室、很少走動）'], [1.35, '輕度（站立或走動多，如門市）'], [1.5, '中度（勞動或整天走動）'], [1.65, '高度（體力工作）']];
  const paceOpts = [[0.25, '0.25 kg（溫和，最好保留肌肉）'], [0.5, '0.5 kg（建議）'], [0.75, '0.75 kg（積極）'], [1, '1 kg（只建議體重較重者）']];
  let h = '';
  if (me()) h += `<div class="card"><h2>這支手機的使用者</h2><div class="seg">${UIDS.map(u => `<button class="${u === me() ? 'on' : ''}" data-act="iam" data-uid="${u}">${esc(nameOf(u))}</button>`).join('')}</div></div>`;
  h += `<div class="card"><h2>個人資料</h2>
    <div class="seg">${UIDS.map(u => `<button class="${u === eu ? 'on' : ''}" data-act="editUid" data-uid="${u}">${esc(nameOf(u))}${u === me() ? '（我）' : ''}</button>`).join('')}</div>
    <div class="avprev mt12" id="avPrev"></div>
    <div class="grid2"><div><label class="f">名字</label><input type="text" data-pf="name" value="${esc(p.name)}"></div>
    <div><label class="f">生理性別（計算代謝用）</label><select data-pf="sex"><option value="F" ${p.sex === 'F' ? 'selected' : ''}>女</option><option value="M" ${p.sex === 'M' ? 'selected' : ''}>男</option></select></div>
    <div><label class="f">出生年（西元）</label><input type="number" inputmode="numeric" data-pf="birthYear" value="${p.birthYear}"></div>
    <div><label class="f">身高 cm</label><input type="number" inputmode="decimal" data-pf="height" value="${p.height}"></div>
    <div><label class="f">起始體重 kg</label><input type="number" inputmode="decimal" step="0.1" data-pf="startWeight" value="${p.startWeight}"></div>
    <div><label class="f">目標體重 kg</label><input type="number" inputmode="decimal" step="0.1" data-pf="goalWeight" value="${p.goalWeight}"></div></div>
    <div id="goalChk" class="tiny muted mt8"></div>
    <label class="f">平常（不含健身房）的活動量</label><select data-pf="life">${lifeOpts.map(o => `<option value="${o[0]}" ${num(p.life) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    <label class="f">每週想減多少</label><select data-pf="pace">${paceOpts.map(o => `<option value="${o[0]}" ${num(p.pace) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
    <label class="f">每週重訓次數</label><select data-pf="trainDays">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${num(p.trainDays) === n ? 'selected' : ''}>${n} 次</option>`).join('')}</select>
    ${macroHTML(p)}
    ${p.sex === 'F' ? `<div class="grid2"><div><label class="f">平常週期天數</label><input type="number" data-pf="cycleLen" value="${p.cycleLen}"></div><div><label class="f">經期天數</label><input type="number" data-pf="periodLen" value="${p.periodLen}"></div></div><div class="tiny muted mt8">記錄 2 次以上經期後，會改用實際平均週期。</div>` : ''}
    <label class="row small mt12"><input type="checkbox" data-pf="remind" ${p.remind !== false ? 'checked' : ''}> App 內提醒（還沒量體重、飲食記錄太少、體組成報告該更新時，鈴鐺會亮）</label>
    ${appearanceHTML(eu, p, av)}
    <button class="btn pri block mt12" data-act="saveProfile">儲存個人資料</button></div>`;
  h += `<div class="card"><h2>雲端同步（Google Apps Script）</h2>
    <label class="f">Web App 網址</label><input type="url" id="cfgUrl" value="${esc(S.cfg.apiUrl)}" placeholder="https://script.google.com/macros/s/…/exec">
    <label class="f">通關密語</label><input type="password" id="cfgTok" value="${esc(S.cfg.token)}" autocomplete="off">
    <div class="grid2 mt12"><button class="btn" data-act="testApi">測試連線</button><button class="btn pri" data-act="saveCfg">儲存並同步</button></div>
    <div class="small muted mt8">${syncStatusText()}</div>
    ${S.cfg.apiUrl ? '<button class="btn block mt8" data-act="aiTest">測試 AI 辨識速度</button><div id="aiTestBox" class="small mt8"></div>' : ''}</div>`;
  h += `<div class="card"><h2>${icon('scale')} 體重機自動同步</h2>
    <div class="small">bpt care → Apple 健康 → iPhone「捷徑」自動化 → 這裡。量完體重、關掉 bpt care，就會自動送過來。</div>
    <button class="btn block mt8" data-act="guideShortcut">看設定步驟（約 5 分鐘）</button></div>`;
  h += `<div class="card"><h2>備份</h2><div class="grid2"><button class="btn" data-act="exportJson">匯出備份檔</button><button class="btn" data-act="importJson">匯入備份檔</button></div>
    <input type="file" id="impFile" accept="application/json,.json" style="display:none">
    <div class="tiny muted mt8">雲端本身就是一份備份（Google 試算表）；這裡是額外的保險。</div></div>
    <div class="card"><h2>關於</h2><div class="row"><div class="grow small muted">版本 ${APP_VERSION} · 本機共 ${Object.keys(S.records).length} 筆資料</div>${catSVG('orange', 'sit', 30)}${catSVG('tabby', 'sit', 30)}</div>
    <div class="row mt8"><button class="btn sm" data-act="checkUpdate">檢查更新</button><button class="btn sm danger" data-act="resetLocal">清除這支手機的資料</button></div></div>`;
  return h;
}
function appearanceHTML(eu, p, av) {
  const v2 = v2On(eu, av); const hasV2 = typeof CHAR_ASSETS !== 'undefined' && !!CHAR_ASSETS[eu];
  let h = '<div class="hr"></div><b class="small">外觀</b>';
  if (hasV2) h += `<label class="row small mt8"><input type="checkbox" data-av="charV2" ${av.charV2 !== false ? 'checked' : ''}> 使用定稿人物</label>`;
  const outfits = v2 ? Object.entries(V2_OUTFIT_NAMES) : Object.entries(OUTFITS).map(([k, o]) => [k, o.name]);
  const cur = v2 && !V2_OUTFIT_NAMES[av.outfit] ? 'stripe' : av.outfit;
  h += `<div class="grid2"><div><label class="f">服裝</label><select data-av="outfit">${outfits.map(([k, n]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>`;
  if (!v2) h += `<div><label class="f">髮型</label><select data-av="hair">${Object.entries(HAIRS).map(([k, v]) => `<option value="${k}" ${av.hair === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
  h += `<div><label class="f">表情</label><select data-av="expr">${Object.entries(EXPRS).map(([k, v]) => `<option value="${k}" ${(av.expr === 'auto' || !av.expr ? 'auto' : normExpr(av.expr)) === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>`;
  if (cur === 'jersey') h += `<div><label class="f">背號</label><input type="text" inputmode="numeric" maxlength="2" data-av="no" value="${esc(av.no || '')}" placeholder="例如 52"></div>`;
  h += '</div>';
  if (cur === 'jersey') h += `<label class="f">球衣配色</label><div class="seg">${Object.entries(JERSEY).map(([k, j]) => `<button class="${(av.jersey || 'yellow') === k ? 'on' : ''}" data-act="jersey" data-v="${k}">${j.name}</button>`).join('')}</div>`;
  else if (v2) { const oid = v2OutfitId(Object.assign({}, av, { outfit: cur })); v2Recolor(eu, oid).forEach(([r, lb]) => { const O = CHAR_CACHE[eu + '/' + oid]; h += swRow(lb || V2_ROLE_NAMES[r] || r, 'oc:' + r, SW_CLOTH, (av.oc && av.oc[oid] && av.oc[oid][r]) || (O && O.colors[r]) || ''); }); }
  else h += swRow('上衣', 'top', SW_CLOTH, av.top) + swRow(av.outfit === 'dress' ? '裙子' : '褲子', 'bottom', SW_CLOTH, av.bottom) + swRow('滾邊／條紋', 'trim', SW_CLOTH, av.trim);
  h += swRow('髮色', 'hairColor', SW_HAIR, av.hairColor) + swRow('膚色', 'skin', SW_SKIN, av.skin);
  if (v2) {
    const stOpt = (key, def) => STAGE_ORDER.slice().reverse().map(k => `<option value="${k}" ${((av[key] || def) === k) ? 'selected' : ''}>${STAGE_NAMES[k]}</option>`).join('');
    h += `<div class="grid2 mt8"><div><label class="f">現在的身形（起點）</label><select data-av="stageStart">${stOpt('stageStart', 'round')}</select></div>
      <div><label class="f">達到目標體重時</label><select data-av="stageGoal">${stOpt('stageGoal', 'neutral')}</select></div></div>
      <div class="tiny muted mt8" id="stageRule">${esc(stageRule(av))}</div>
      <label class="f">預覽身形</label><div class="seg">${CHAR_STAGES.map(k => `<button class="${(UI.previewStage || (hasProfile(eu) ? bodyStage(eu, av) : 'round')) === k ? 'on' : ''}" data-act="previewStage" data-v="${k}">${STAGE_NAMES[k]}</button>`).join('')}</div>`;
  }
  else h += '<div class="tiny muted mt8">人物身形會隨「7 日平均體重」慢慢改變；表情選「自動」時，會依當天睡眠、訓練、飲食變化。</div>';
  return h;
}
function swRow(label, key, list, cur) { return `<label class="f">${label}</label><div class="swatches">${list.map(c => `<button class="sw ${c.toLowerCase() === String(cur).toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="sw" data-k="${key}" data-v="${c}" aria-label="${c}"></button>`).join('')}</div>`; }
function previewFat(p) { const h = num(p.height) / 100; const u = UI.draft && UI.draft.uid; const w = u && weights(u).length ? trendWeight(u) : num(p.startWeight); return h ? clamp((w / (h * h) - 18.5) / (33 - 18.5), 0, 1) : 0.3; }
function readProfileForm() {
  const p = UI.draft.p;
  $$('[data-pf]').forEach(el => { const k = el.dataset.pf; if (el.type === 'checkbox') p[k] = el.checked; else if (['name', 'sex', 'macroMode'].includes(k)) p[k] = el.value; else p[k] = num(el.value); });
  $$('[data-av]').forEach(el => { p.avatar[el.dataset.av] = el.type === 'checkbox' ? el.checked : el.value; });
  return p;
}
function refreshPreview() {
  const p = readProfileForm(); const box = $('#avPrev'); if (!box) return;
  const rule = $('#stageRule'); if (rule) rule.textContent = stageRule(p.avatar);
  box.innerHTML = renderAvatar(UI.draft.uid, p.avatar, previewFat(p), { expr: p.avatar.expr === 'auto' ? 'calm' : p.avatar.expr, stage: UI.previewStage || (hasProfile(UI.draft.uid) ? bodyStage(UI.draft.uid, p.avatar) : null) });
  const h = num(p.height) / 100, g = num(p.goalWeight); const el = $('#goalChk');
  macroPreview(p);
  if (el && h && g) { const bmi = g / (h * h); el.textContent = `目標 BMI ${r1(bmi)}` + (bmi < 18.5 ? '，低於 18.5 屬體重過輕，建議把目標放在增肌或維持。' : (bmi < 20 ? '，已在偏瘦範圍，之後建議以腰圍和力量進步為主要目標。' : '')); }
}
function syncStatusText() {
  if (!S.cfg.apiUrl) return '目前：僅存在本機（兩人看不到彼此，也沒有 AI 功能）';
  return (S.syncErr ? '⚠ ' + esc(S.syncErr) : (S.lastSyncAt ? '最後同步：' + new Date(S.lastSyncAt).toLocaleString('zh-TW', { hour12: false }) : '尚未同步')) + (S.pending.length ? `（待上傳 ${S.pending.length} 筆）` : '');
}
function sheetShortcutGuide() {
  const u = me() || 'A';
  openSheet(`<h3>${icon('scale')} 體重機自動同步<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    <div class="small"><b>前置</b>：bpt care 打開「同步到 Apple 健康」，允許寫入體重、體脂率。量一次，確認「健康」App → 瀏覽 → 身體測量 → 體重 有數字。</div>
    <div class="small mt12"><b>A. 建立捷徑「同步體重」</b>（捷徑 App → 右上 ＋），依序加入：</div>
    <ol class="steps">
      <li><b>尋找健康樣本</b>：過濾條件「類型 是 體重」，排序「開始日期」、順序「最新優先」，限制開啟、數量 1。</li>
      <li><b>設定變數</b>：名稱 <b>體重</b>。</li>
      <li><b>尋找健康樣本</b>：類型改「體脂率」，其他同上。</li>
      <li><b>設定變數</b>：名稱 <b>體脂</b>。</li>
      <li><b>取得 URL 的內容</b>：URL 貼下方網址；展開後方法 <b>POST</b>、要求本文 <b>JSON</b>，新增 6 個「文字」欄位：
        <div class="code mt8">action → health<br>token → （你們的通關密語）<br>uid → ${u}<br>weight → 變數「體重」→ 點一下選「值」<br>date → 變數「體重」→ 點一下選「開始日期」→ 日期格式 ISO 8601<br>bodyfat → 變數「體脂」→ 點一下選「值」</div></li>
      <li><b>顯示通知</b>：內容選「取得 URL 的內容」（看結果用，穩定後可刪）。</li>
    </ol>
    <div class="small"><b>網址</b></div><div class="code">${esc(S.cfg.apiUrl || '（請先在設定填好雲端網址）')}</div>
    <div class="small mt12"><b>B. 測試</b>：按 ▶，允許健康資料與連線 script.google.com（選「一律允許」），通知出現「已同步 … kg」就成功。</div>
    <div class="small mt12"><b>C. 自動執行</b>（捷徑 App → 自動化 → ＋）</div>
    <ol class="steps"><li>「<b>App</b>」→ 選 <b>bpt care</b> → 勾「<b>已關閉</b>」→「<b>立即執行</b>」→ 選「同步體重」。</li>
    <li>再加一個保險：「<b>特定時間</b>」每天 10:00 →「立即執行」→「同步體重」。</li></ol>
    <div class="note mt8">另一半在<b>自己的手機</b>做一樣的設定，uid 填 <b>${otherUid(u)}</b>。等 bpt care 顯示完數字再離開；同一天以最後一次為準。肌肉量等完整數據偶爾用「上傳 bpt care 報告」補上。</div>`);
}

/* ---------- 通知中心 ---------- */
function sheetNotif() {
  const list = notifications(); const seen = S.cfg.seen || {};
  const item = n => `<div class="nt ${n.kind}" data-act="notifGo" data-id="${esc(n.id)}"><div class="ni">${icon(n.ic)}</div><div class="nb"><b>${esc(n.title)}</b><div>${esc(n.body)}</div></div>${!seen[n.id] ? '<span class="new"></span>' : ''}</div>`;
  const grp = (title, arr) => arr.length ? `<div class="ng">${title}</div>${arr.map(item).join('')}` : '';
  const todo = list.filter(n => n.kind === 'todo'), info = list.filter(n => n.kind === 'info'), msg = list.filter(n => n.kind === 'msg');
  openSheet(`<h3>${icon('bell')} 通知<button class="btn sm ghost x" data-act="closeSheet">關閉</button></h3>
    ${list.length ? grp('今天待辦', todo) + grp('提醒', info) + grp('動態與應援', msg) : `<div class="row" style="justify-content:center;padding:18px 0;gap:6px">${catSVG('orange', 'sit', 34)}<div class="small muted">目前沒有新通知，今天的事都做完了。</div></div>`}
    <div class="tiny muted mt12">待辦做完會自動消失；應援和動態保留 7 天。</div>`);
}

/* ---------- 三大營養素比例設定 ---------- */
function macroHTML(p) {
  const m = MACRO_PRESETS[p.macroMode] ? p.macroMode : 'auto'; const pre = MACRO_PRESETS[m];
  const val = k => m === 'custom' ? num(p['macro' + k]) : (pre[k.toLowerCase()] != null ? pre[k.toLowerCase()] : '');
  let h = `<label class="f">三大營養素比例（佔每日熱量）</label>
    <input type="hidden" data-pf="macroMode" value="${m}">
    <div class="seg rwrap">${Object.entries(MACRO_PRESETS).map(([k, o]) => `<button class="${m === k ? 'on' : ''}" data-act="macroMode" data-v="${k}">${o.name}</button>`).join('')}</div>
    <div class="tiny muted mt8">${esc(pre.hint)}</div>`;
  if (m !== 'auto') h += `<div class="grid3 mt8">${[['P', '蛋白質'], ['C', '碳水'], ['F', '脂肪']].map(([k, n]) =>
    `<div><label class="f">${n} %</label><input type="number" inputmode="numeric" step="5" min="5" max="70" data-pf="macro${k}" value="${val(k)}" ${m === 'custom' ? '' : 'disabled'}></div>`).join('')}</div>`;
  if (m !== 'auto' && m !== 'custom') h += `<div class="tiny muted mt8">想微調的話，按「自訂」會帶入這組數字讓你改。</div>`;
  return h + '<div id="macroChk" class="small mt8"></div>';
}
function macroPreview(p) {
  const el = $('#macroChk'); if (!el || !UI.draft) return;
  const tg = targets(UI.draft.uid, p); const w = macroWarnings(p, tg);
  el.innerHTML = `<div class="note" style="margin:0">每日 <b>${tg.kcal}</b> kcal → 蛋白質 <b>${tg.p}</b>g（${r1(tg.p / tg.refW)} g/kg）· 碳水 <b>${tg.c}</b>g · 脂肪 <b>${tg.f}</b>g
    <div class="tiny muted">實際佔比：${r0(tg.p * 400 / tg.kcal)}% ／ ${r0(tg.c * 400 / tg.kcal)}% ／ ${r0(tg.f * 900 / tg.kcal)}%</div></div>`
    + w.map(x => `<div class="tiny mt8" style="color:#b0552f">⚠ ${esc(x)}</div>`).join('');
}
