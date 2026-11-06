'use strict';
/* =========================================================
   兩人減脂 v2 — 圖像：Q 版人物、貓咪、棒球元素、圖表
   ========================================================= */
const INK = '#4a3426';
let _svgSeq = 0;

const OUTFITS = {
  stripe: { name: '條紋T＋短褲', top: 'stripe', bottom: 'shorts' },
  pocket: { name: '口袋T＋短褲', top: 'pocket', bottom: 'shorts' },
  hoodie: { name: '帽T＋縮口褲', top: 'hoodie', bottom: 'joggers' },
  sport: { name: '運動內衣＋緊身褲', top: 'bra', bottom: 'leggings' },
  shirt: { name: '襯衫＋寬褲', top: 'shirt', bottom: 'wide' },
  raglan: { name: '運動T＋運動短褲', top: 'raglan', bottom: 'shorts' },
  jersey: { name: '棒球衣＋球褲', top: 'jersey', bottom: 'basepants' },
  dress: { name: '洋裝', top: 'dress', bottom: 'none' },
};
const HAIRS = { bob: '鮑伯頭', curly: '捲髮', long: '長直髮', bun: '包包頭', short: '短髮', buzz: '平頭' };
const EXPRS = { auto: '自動（依今日狀態）', smile: '微笑', happy: '開心', calm: '溫和', proud: '有幹勁', sleepy: '想睡', sweat: '流汗' };
const SW_CLOTH = ['#ffffff', '#f7f4ec', '#ffd23f', '#f5b800', '#1f2d4d', '#3d4352', '#5b7aa6', '#8a7a52', '#e9e2d0', '#d9a5a0', '#9cb59a', '#2b2b2b'];
const SW_HAIR = ['#2a1e17', '#4a3426', '#6b4a32', '#8a5a3c', '#b98a5e', '#9a9a9a'];
const SW_SKIN = ['#fde7d6', '#f9dcc6', '#f2c9aa', '#e2ac86', '#c08a64', '#8f5f43'];

/* ---------- Q 版人物 ---------- */
function avatarSVG(av, f, opt = {}) {
  f = clamp(f, 0, 1); const id = 'av' + (++_svgSeq); const sw = 2; const cx = 60;
  const O = OUTFITS[av.outfit] || OUTFITS.pocket;
  const expr = opt.expr || (av.expr && av.expr !== 'auto' ? av.expr : 'smile');
  const skin = av.skin, top = av.top, bot = av.bottom, trim = av.trim || '#1f2d4d', hair = av.hairColor;
  const sh = 14 + 4 * f, hp = 13.5 + 10 * f, yS = 80, yH = 116, yC = 122, yA = 156;
  const aw = 7.5 + 4 * f, lw = 10 + 6.5 * f, lo = 6 + 4 * f;
  const hw = 30 + 1.5 * f, L = cx - hw, R = cx + hw;
  const ln = (x1, y1, x2, y2, w, col) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${col}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
  const limb = (a, w, col) => ln(a[0], a[1], a[2], a[3], w + sw * 2, INK) + ln(a[0], a[1], a[2], a[3], w, col);
  const part = (a, t) => [a[0], a[1], a[0] + (a[2] - a[0]) * t, a[1] + (a[3] - a[1]) * t];
  const torso = (hem, flare) => { const bx = hp + flare; return `M${cx - sh},${yS} C${cx - sh - 1},${yS + 14} ${cx - hp - 3 - 7 * f},${hem - 14} ${cx - bx},${hem} L${cx + bx},${hem} C${cx + hp + 3 + 7 * f},${hem - 14} ${cx + sh + 1},${yS + 14} ${cx + sh},${yS} Q${cx},${yS - 5} ${cx - sh},${yS} Z`; };
  const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const aL = [cx - sh + 3, yS + 4, cx - sh - 5 - 4 * f, yS + 32], aR = [cx + sh - 3, yS + 4, cx + sh + 5 + 4 * f, yS + 32];
  const legs = [[cx - lo, yC - 6, cx - lo, yA], [cx + lo, yC - 6, cx + lo, yA]];
  let g = '', defs = '';

  /* 後髮 */
  if (av.hair === 'bob') g += P(`M${L - 1},44 C${L - 4},62 ${L - 3},76 ${L + 4},80 L${R - 4},80 C${R + 3},76 ${R + 4},62 ${R + 1},44 Z`, hair);
  if (av.hair === 'long') g += P(`M${L - 1},44 C${L - 5},80 ${L - 2},100 ${L + 6},104 L${R - 6},104 C${R + 2},100 ${R + 5},80 ${R + 1},44 Z`, hair);
  if (av.hair === 'bun') g += `<circle cx="${cx}" cy="15" r="10" fill="${hair}" stroke="${INK}" stroke-width="${sw}"/>`;
  if (av.hair === 'curly') g += P(curlyCloud(cx, 44, hw + 9, 34, 160, 380, 13), hair);

  /* 腿、鞋 */
  legs.forEach(l => { g += limb(l, lw, skin); });
  /* 下身 */
  const B = O.bottom;
  if (B === 'shorts') { legs.forEach(l => { g += limb([l[0], l[1], l[2], yC + 11], lw + 3, bot); }); }
  else if (B === 'pants') { legs.forEach(l => { g += limb([l[0], l[1], l[2], yA - 2], lw + 4, bot); }); }
  else if (B === 'joggers') { legs.forEach(l => { g += limb([l[0], l[1], l[2], yA - 3], lw + 4.5, bot); g += `<rect x="${(l[0] - (lw + 3) / 2).toFixed(1)}" y="${yA - 6}" width="${(lw + 3).toFixed(1)}" height="4" rx="2" fill="${bot}" stroke="${INK}" stroke-width="1.4"/>`; }); }
  else if (B === 'leggings') { legs.forEach(l => { g += limb([l[0], l[1], l[2], yA - 3], lw + 1.5, bot); }); }
  else if (B === 'wide') { legs.forEach(l => { const s = l[0] < cx ? -1 : 1; const x0 = l[0] - (lw + 4) / 2, x1 = l[0] + (lw + 4) / 2; g += P(`M${x0},${yC - 6} L${x1},${yC - 6} L${x1 + (s > 0 ? 3 : 1)},${yA - 1} L${x0 - (s < 0 ? 3 : 1)},${yA - 1} Z`, bot); }); }
  else if (B === 'basepants') { legs.forEach(l => { g += limb([l[0], yA - 12, l[2], yA - 1], lw + 1, trim); g += limb([l[0], l[1], l[2], yA - 12], lw + 4.5, bot); }); }
  if (B !== 'none') {
    g += `<rect x="${(cx - hp - 0.5).toFixed(1)}" y="${yH - 5}" width="${(2 * hp + 1).toFixed(1)}" height="${yC - yH + 9}" rx="4" fill="${bot}" stroke="${INK}" stroke-width="${sw}"/>`;
    if (av.outfit === 'raglan') legs.forEach(l => { const x = l[0] < cx ? l[0] - (lw + 3) / 2 + 1.5 : l[0] + (lw + 3) / 2 - 1.5; g += ln(x, yC - 4, x, yC + 10, 1.6, trim); });
  }
  legs.forEach(l => { const s = l[0] < cx ? -1 : 1; const w = lw / 2 + 4; const x = l[0] + s * 1.5;
    g += P(`M${(x - w).toFixed(1)},${yA + 6} C${(x - w).toFixed(1)},${yA - 2} ${(x + w).toFixed(1)},${yA - 2} ${(x + w).toFixed(1)},${yA + 6} Z`, '#fbfaf6');
    g += ln(x - w + 1.5, yA + 4.5, x + w - 1.5, yA + 4.5, 1, '#c9c2b4'); });

  /* 手臂、脖子、軀幹 */
  g += limb(aL, aw, skin) + limb(aR, aw, skin);
  g += `<rect x="${cx - 5}" y="68" width="10" height="16" fill="${skin}" stroke="${INK}" stroke-width="${sw}"/>`;
  g += P(torso(yH, 0), skin);
  const T = O.top;
  if (T === 'dress') {
    g += P(`M${cx - hp + 1},${yH - 12} L${cx + hp - 1},${yH - 12} L${cx + hp + 10},${yC + 18} Q${cx},${yC + 23} ${cx - hp - 10},${yC + 18} Z`, bot);
    g += P(torso(yH - 8, -1), top);
    g += limb(part(aL, 0.28), aw + 3, top) + limb(part(aR, 0.28), aw + 3, top);
  } else if (T === 'bra') {
    g += P(`M${cx - sh + 1},${yS + 1} C${cx - sh},${yS + 9} ${cx - sh - 1 - 2 * f},${yS + 13} ${cx - sh - 1 - 2 * f},${yS + 16} L${cx + sh + 1 + 2 * f},${yS + 16} C${cx + sh + 1 + 2 * f},${yS + 13} ${cx + sh},${yS + 9} ${cx + sh - 1},${yS + 1} Q${cx},${yS + 8} ${cx - sh + 1},${yS + 1} Z`, top);
    g += `<path d="M${cx - 6},${yS + 4} Q${cx},${yS + 8} ${cx + 6},${yS + 4}" fill="none" stroke="${INK}" stroke-width="1.2" opacity=".6"/>`;
  } else {
    const sleeveT = { hoodie: 0.92, shirt: 0.62 }[T] || 0.4;
    const hem = T === 'hoodie' ? yH + 6 : T === 'shirt' ? yH + 4 : yH + 3;
    const sleeveCol = T === 'raglan' ? trim : top;
    g += limb(part(aL, sleeveT), aw + 3.5, sleeveCol) + limb(part(aR, sleeveT), aw + 3.5, sleeveCol);
    g += P(torso(hem, T === 'hoodie' ? 2 : 1), top);
    if (T === 'stripe') {
      defs += `<clipPath id="${id}c"><path d="${torso(hem, 1)}"/></clipPath>`;
      let st = ''; for (let y = yS + 5; y < hem; y += 6.5) st += `<rect x="20" y="${y}" width="80" height="2.6" fill="${trim}"/>`;
      g += `<g clip-path="url(#${id}c)" opacity=".85">${st}</g>` + P(torso(hem, 1), 'none');
      [aL, aR].forEach(a => { const q = part(a, 0.28); g += ln(q[2] - 3, q[3] - 1, q[2] + 3, q[3] + 1, 2, trim); });
    }
    if (T === 'pocket') g += P(`M${cx + 3},${yS + 9} h8 v7 q-4,2 -8,0 Z`, top);
    if (T === 'hoodie') {
      g += P(`M${cx - 11},${yH - 6} L${cx + 11},${yH - 6} L${cx + 13},${yH + 3} L${cx - 13},${yH + 3} Z`, 'none');
      g += P(`M${cx - 10},${yS - 1} Q${cx},${yS + 7} ${cx + 10},${yS - 1}`, 'none');
      g += ln(cx - 3, yS + 3, cx - 3, yS + 14, 1.3, INK) + ln(cx + 3, yS + 3, cx + 3, yS + 14, 1.3, INK);
    }
    if (T === 'shirt') {
      g += P(`M${cx - 7},${yS - 2} L${cx},${yS + 6} L${cx - 4},${yS + 9} L${cx - 9},${yS + 1} Z`, top) + P(`M${cx + 7},${yS - 2} L${cx},${yS + 6} L${cx + 4},${yS + 9} L${cx + 9},${yS + 1} Z`, top);
      g += ln(cx, yS + 6, cx, hem, 1, INK); [yS + 12, yS + 20, yS + 28].forEach(y => { g += `<circle cx="${cx + 2}" cy="${y}" r="0.9" fill="${INK}"/>`; });
      [aL, aR].forEach(a => { const q = part(a, 0.62); g += ln(q[2] - 4, q[3] - 1.5, q[2] + 4, q[3] + 1.5, 3, top) ; });
    }
    if (T === 'raglan') g += `<path d="M${cx - 8},${yS - 1} Q${cx},${yS + 6} ${cx + 8},${yS - 1}" fill="none" stroke="${trim}" stroke-width="2.4"/>`;
    if (T === 'jersey') {
      g += `<path d="M${cx - 8},${yS - 1} L${cx},${yS + 8} L${cx + 8},${yS - 1}" fill="none" stroke="${trim}" stroke-width="2.4" stroke-linejoin="round"/>`;
      g += ln(cx, yS + 8, cx, hem - 1, 1.2, trim); [yS + 13, yS + 20, yS + 27].forEach(y => { g += `<circle cx="${cx}" cy="${y}" r="0.9" fill="${trim}"/>`; });
      [aL, aR].forEach(a => { const q = part(a, 0.4); const dx = (q[2] - q[0]), dy = (q[3] - q[1]); const k = 2.5 / Math.hypot(dx, dy);
        g += ln(q[2] - dx * k - (aw + 2) * dy / Math.hypot(dx, dy) / 2, q[3] - dy * k + (aw + 2) * dx / Math.hypot(dx, dy) / 2, q[2] - dx * k + (aw + 2) * dy / Math.hypot(dx, dy) / 2, q[3] - dy * k - (aw + 2) * dx / Math.hypot(dx, dy) / 2, 2.2, trim); });
      if (av.no !== '' && av.no != null) g += `<text x="${cx + 7.5}" y="${yS + 21}" text-anchor="middle" font-size="9" font-weight="800" font-family="Arial,Helvetica,sans-serif" fill="${trim}">${esc(String(av.no).slice(0, 2))}</text>`;
    }
  }

  /* 頭 */
  [[L - 1, -1], [R + 1, 1]].forEach(([x, s]) => { g += `<ellipse cx="${x}" cy="55" rx="5" ry="6" fill="${skin}" stroke="${INK}" stroke-width="${sw}"/><path d="M${x - s * 1.5},52 q${s * 2},2 0,5" fill="none" stroke="${INK}" stroke-width="1" opacity=".6"/>`; });
  g += `<ellipse cx="${cx}" cy="48" rx="${hw}" ry="28.5" fill="${skin}" stroke="${INK}" stroke-width="${sw}"/>`;
  /* 臉 */
  g += `<ellipse cx="${cx - 19}" cy="61" rx="5" ry="3" fill="#f6a49c" opacity=".55"/><ellipse cx="${cx + 19}" cy="61" rx="5" ry="3" fill="#f6a49c" opacity=".55"/>`;
  const eyeY = 53, ex = [cx - 11, cx + 11];
  const openEye = x => `<ellipse cx="${x}" cy="${eyeY}" rx="3" ry="3.9" fill="#2b211b"/><circle cx="${x + 1}" cy="${eyeY - 1.5}" r="1.1" fill="#fff"/>`;
  const arcUp = x => `<path d="M${x - 4},${eyeY + 1} Q${x},${eyeY - 4} ${x + 4},${eyeY + 1}" fill="none" stroke="#2b211b" stroke-width="2" stroke-linecap="round"/>`;
  const arcDown = x => `<path d="M${x - 4},${eyeY} Q${x},${eyeY + 3} ${x + 4},${eyeY}" fill="none" stroke="#2b211b" stroke-width="1.8" stroke-linecap="round"/>`;
  const brow = (x, tilt) => `<path d="M${x - 4},${44 + (x < cx ? -tilt : tilt)} Q${x},${42} ${x + 4},${44 + (x < cx ? tilt : -tilt)}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>`;
  const smileM = `<path d="M${cx - 4},61 Q${cx},64.5 ${cx + 4},61" fill="none" stroke="#2b211b" stroke-width="1.7" stroke-linecap="round"/>`;
  if (expr === 'happy') g += arcUp(ex[0]) + arcUp(ex[1]) + `<path d="M${cx - 5},60 Q${cx},68 ${cx + 5},60 Z" fill="#e9897e" stroke="#2b211b" stroke-width="1.5" stroke-linejoin="round"/>`;
  else if (expr === 'calm') g += arcUp(ex[0]) + arcUp(ex[1]) + smileM;
  else if (expr === 'sleepy') g += arcDown(ex[0]) + arcDown(ex[1]) + `<ellipse cx="${cx}" cy="62" rx="1.8" ry="2.2" fill="#e9897e" stroke="#2b211b" stroke-width="1.2"/><text x="${R + 2}" y="20" font-size="9" font-weight="700" fill="${INK}" font-family="Arial">z<tspan font-size="7" dy="-4">z</tspan></text>`;
  else if (expr === 'proud') g += brow(ex[0], 1.8) + brow(ex[1], 1.8) + openEye(ex[0]) + openEye(ex[1]) + smileM + sparkle(R + 4, 18, 5, '#f5b800');
  else if (expr === 'sweat') g += brow(ex[0], 0) + brow(ex[1], 0) + openEye(ex[0]) + openEye(ex[1]) + smileM + `<path d="M${R - 3},34 q-3,5 0,7 q3,-2 0,-7 Z" fill="#9fd3ef" stroke="${INK}" stroke-width="1"/>`;
  else g += brow(ex[0], 0) + brow(ex[1], 0) + openEye(ex[0]) + openEye(ex[1]) + smileM;

  /* 前髮 */
  if (av.hair === 'bob' || av.hair === 'long') {
    g += P(`M${L - 1},56 C${L - 4},30 ${L + 10},16 ${cx},16 C${R - 10},16 ${R + 4},30 ${R + 1},56 C${R - 1},50 ${R - 3},44 ${R - 6},40 C${R - 14},38 ${cx + 6},34 ${cx - 2},26 C${cx - 8},34 ${L + 12},39 ${L + 3},42 C${L + 1},46 ${L},51 ${L - 1},56 Z`, hair);
    g += P(`M${L},44 C${L - 2},58 ${L - 1},70 ${L + 3},78 L${L + 8},77 C${L + 5},68 ${L + 4},56 ${L + 5},44 Z`, hair) + P(`M${R},44 C${R + 2},58 ${R + 1},70 ${R - 3},78 L${R - 8},77 C${R - 5},68 ${R - 4},56 ${R - 5},44 Z`, hair);
    g += `<path d="M${cx - 2},26 C${cx - 4},22 ${cx - 7},20 ${cx - 11},19" fill="none" stroke="${INK}" stroke-width="1" opacity=".55"/><path d="M${R - 12},30 C${R - 8},34 ${R - 5},40 ${R - 4},48" fill="none" stroke="${INK}" stroke-width="1" opacity=".45"/>`;
  } else if (av.hair === 'curly') {
    g += P(curlyFringe(cx, L, R), hair);
    g += `<path d="M${cx - 2},17 C${cx - 6},8 ${cx + 5},5 ${cx + 3},13" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  } else if (av.hair === 'bun' || av.hair === 'short') {
    const low = av.hair === 'short' ? 30 : 34;
    g += P(`M${L},52 C${L - 3},16 ${R + 3},16 ${R},52 Q${R - 6},${low - 2} ${cx + 8},${low} Q${cx},${low + 4} ${cx - 8},${low - 1} Q${L + 8},${low} ${L},52 Z`, hair);
  } else if (av.hair === 'buzz') {
    g += P(`M${L + 3},40 C${L + 3},18 ${R - 3},18 ${R - 3},40 Q${cx},29 ${L + 3},40 Z`, hair);
  }
  return `<svg class="av" viewBox="0 0 120 172" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="人物"><defs>${defs}</defs>${g}</svg>`;
}
function curlyCloud(cx, cy, rx, ry, a0, a1, n) {
  const pts = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + rx * Math.cos(a), cy - ry * Math.sin(a)]); }
  let d = `M${cx - rx * 0.72},${cy + 24} L${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const k = 1.16; const qx = cx + (mx - cx) * k, qy = cy + (my - cy) * k;
    d += ` Q${qx.toFixed(1)},${qy.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
  }
  return d + ` L${cx + rx * 0.72},${cy + 24} Z`;
}
function curlyFringe(cx, L, R) {
  // 頂部弧形 + 下緣一顆顆捲
  let d = `M${L - 4},54 C${L - 9},10 ${R + 9},10 ${R + 4},54`;
  const pts = [[R + 4, 54], [R - 1, 44], [R - 8, 37], [R - 17, 35], [cx + 6, 37], [cx - 3, 33], [cx - 12, 37], [L + 12, 35], [L + 4, 40], [L - 4, 54]];
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; d += ` Q${((x0 + x1) / 2).toFixed(1)},${(Math.max(y0, y1) + 7).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`; }
  return d + ' Z';
}
function sparkle(x, y, r, col) { return `<path d="M${x},${y - r} Q${x + r * 0.2},${y - r * 0.2} ${x + r},${y} Q${x + r * 0.2},${y + r * 0.2} ${x},${y + r} Q${x - r * 0.2},${y + r * 0.2} ${x - r},${y} Q${x - r * 0.2},${y - r * 0.2} ${x},${y - r} Z" fill="${col}"/>`; }

/* ---------- 貓咪（橘貓、白底虎斑） ---------- */
function catSVG(kind = 'orange', pose = 'sit', w = 40) {
  const base = kind === 'orange' ? '#f4b06a' : '#fdfbf6';
  const mark = kind === 'orange' ? '#dc8a3f' : '#8f8f8f';
  const mark2 = kind === 'orange' ? '#dc8a3f' : '#666';
  const o = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  let g = '';
  if (pose === 'loaf') {
    g += `<path d="M34,36 C42,36 44,30 38,29" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M34,36 C42,36 44,30 38,29" fill="none" stroke="${base}" stroke-width="2.4" stroke-linecap="round"/>`;
    g += `<path d="M6,36 C4,26 12,21 22,22 C32,21 40,26 38,36 Z" fill="${base}" ${o}/>`;
    g += `<path d="M7,23 L8,15 L13,20 M19,19 L23,14 L25,21" fill="${base}" ${o}/><ellipse cx="15" cy="25" rx="9" ry="7.5" fill="${base}" ${o}/>`;
    if (kind === 'tabby') g += `<path d="M9,20 Q15,17 21,20 Q19,23 15,23 Q11,23 9,20 Z" fill="${mark}"/><path d="M26,24 Q32,22 37,27 Q32,28 28,27 Z" fill="${mark}"/>`;
    g += `<path d="M13,19 v3 M16,18 v3 M19,19 v3" stroke="${mark2}" stroke-width="1.2" stroke-linecap="round"/>`;
    g += `<path d="M11,26 q1.5,1.2 3,0 M17,26 q1.5,1.2 3,0" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>`;
    g += `<path d="M27,30 q2,-2 4,0 M31,31 q2,-2 4,0" fill="none" stroke="${mark2}" stroke-width="1.1" stroke-linecap="round"/>`;
    return `<svg class="cat" viewBox="0 0 44 40" width="${w}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
  }
  g += `<path d="M31,39 C41,38 42,27 36,25" fill="none" stroke="${INK}" stroke-width="4.8" stroke-linecap="round"/><path d="M31,39 C41,38 42,27 36,25" fill="none" stroke="${kind === 'tabby' ? mark : base}" stroke-width="2.6" stroke-linecap="round"/>`;
  g += `<path d="M10,40 C7,30 11,21 21,21 C31,21 35,30 32,40 Z" fill="${base}" ${o}/>`;
  if (kind === 'tabby') g += `<path d="M24,22 C30,23 33,29 33,34 C29,32 26,28 24,22 Z" fill="${mark}"/>`;
  g += `<path d="M12,12 L13,3 L19,9 Z M23,9 L29,3 L30,12 Z" fill="${base}" ${o}/>`;
  g += `<ellipse cx="21" cy="15" rx="10" ry="8.5" fill="${base}" ${o}/>`;
  if (kind === 'tabby') g += `<path d="M12,12 Q21,5 30,12 Q26,14 21,13.5 Q16,14 12,12 Z" fill="${mark}"/>`;
  g += `<path d="M18,8.5 v3 M21,8 v3.2 M24,8.5 v3" stroke="${mark2}" stroke-width="1.2" stroke-linecap="round"/>`;
  if (kind === 'orange') g += `<path d="M13,30 q3,-1.5 5,0 M24,30 q3,-1.5 5,0" fill="none" stroke="${mark}" stroke-width="1.2" stroke-linecap="round"/>`;
  g += `<circle cx="17.5" cy="16" r="1.1" fill="${INK}"/><circle cx="24.5" cy="16" r="1.1" fill="${INK}"/><path d="M20.2,18.4 L21,19.3 L21.8,18.4" fill="none" stroke="${INK}" stroke-width="1"/>`;
  g += `<path d="M11,18 h-4 M11,19.5 l-4,1.2 M31,18 h4 M31,19.5 l4,1.2" stroke="${INK}" stroke-width=".7" opacity=".6"/>`;
  g += `<path d="M16,40 v-4 M26,40 v-4" stroke="${INK}" stroke-width="1.2" opacity=".6"/>`;
  return `<svg class="cat" viewBox="0 0 44 42" width="${w}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}
function pawSVG(w = 14, col = '#c9b9a0') {
  return `<svg viewBox="0 0 20 20" width="${w}" height="${w}" aria-hidden="true"><ellipse cx="10" cy="13" rx="5" ry="4.2" fill="${col}"/><circle cx="4.5" cy="8" r="2" fill="${col}"/><circle cx="8" cy="4.8" r="2" fill="${col}"/><circle cx="12" cy="4.8" r="2" fill="${col}"/><circle cx="15.5" cy="8" r="2" fill="${col}"/></svg>`;
}

/* ---------- 棒球元素 ---------- */
function ballRing(val, target, size = 120) {
  const R = 46, C = 2 * Math.PI * R, pct = target > 0 ? val / target : 0, over = pct > 1.05; const rem = target - val;
  const seam = (s) => `M${55 + s * 34},17 C${55 + s * 18},38 ${55 + s * 18},72 ${55 + s * 34},93`;
  return `<svg class="ring" viewBox="0 0 110 110" width="${size}" height="${size}">
  <circle cx="55" cy="55" r="${R}" fill="#fff" stroke="#efe9dc" stroke-width="10"/>
  <g opacity=".32"><path d="${seam(-1)}" fill="none" stroke="#d2463c" stroke-width="1.2"/><path d="${seam(-1)}" fill="none" stroke="#d2463c" stroke-width="5" stroke-dasharray="1.4 4"/>
  <path d="${seam(1)}" fill="none" stroke="#d2463c" stroke-width="1.2"/><path d="${seam(1)}" fill="none" stroke="#d2463c" stroke-width="5" stroke-dasharray="1.4 4"/></g>
  <circle cx="55" cy="55" r="${R}" fill="none" stroke="${over ? '#d2603f' : '#1f2d4d'}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(C * Math.min(pct, 1)).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 55 55)"/>
  <text x="55" y="48" text-anchor="middle" font-size="10.5" fill="#8a8577">${rem >= 0 ? '還可吃' : '已超過'}</text>
  <text x="55" y="67" text-anchor="middle" font-size="21" font-weight="800" fill="${over ? '#d2603f' : '#1f2433'}">${r0(Math.abs(rem))}</text>
  <text x="55" y="80" text-anchor="middle" font-size="10" fill="#8a8577">kcal</text></svg>`;
}
function diamondSVG(pct, col = '#1f2d4d', size = 54) {
  const P = [[30, 54], [54, 30], [30, 6], [6, 30], [30, 54]]; pct = clamp(pct, 0, 100);
  const segs = pct / 25; let d = `M${P[0][0]},${P[0][1]}`; let cur = P[0];
  for (let i = 0; i < 4; i++) { const t = clamp(segs - i, 0, 1); if (t <= 0) break; const a = P[i], b = P[i + 1]; cur = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; d += ` L${cur[0].toFixed(1)},${cur[1].toFixed(1)}`; }
  const base = (x, y, on) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" transform="rotate(45 ${x} ${y})" fill="${on ? '#f5b800' : '#fff'}" stroke="${INK}" stroke-width="1.2"/>`;
  return `<svg class="dia" viewBox="0 0 60 60" width="${size}" height="${size}">
   <path d="M30,54 L54,30 L30,6 L6,30 Z" fill="#f1ecdf" stroke="#d9d1bf" stroke-width="1.2"/>
   <path d="${d}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
   ${base(54, 30, pct >= 25)}${base(30, 6, pct >= 50)}${base(6, 30, pct >= 75)}
   <path d="M25,52 h10 v3 l-5,4 l-5,-4 Z" fill="${pct >= 100 ? '#f5b800' : '#fff'}" stroke="${INK}" stroke-width="1.2"/>
   <circle cx="${cur[0].toFixed(1)}" cy="${cur[1].toFixed(1)}" r="4" fill="${col}" stroke="#fff" stroke-width="1.5"/></svg>`;
}
const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M5 4h14v9l-7 7-7-7z"/></svg>',
  food: '<svg viewBox="0 0 24 24"><path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M14 3l-3 7M18 4l-4 6"/></svg>',
  gym: '<svg viewBox="0 0 24 24"><path d="M4 20l3-3M6.5 17.5L19 5a1.6 1.6 0 0 0-2.3-2.3L4.5 15.2z"/><circle cx="18" cy="18" r="2.6"/></svg>',
  body: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 11a4 4 0 0 1 8 0"/><path d="M12 11l2-2"/></svg>',
  set: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  tag: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  txt: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/></svg>',
  glove: '<svg viewBox="0 0 24 24"><path d="M6 20c-2-3-2-8 0-12 1-2 3-2 3 0V6c0-2 3-2 3 0v-1c0-2 3-2 3 0v2c0-2 3-1.5 3 .5V13c0 4-3 7-7 7z"/><path d="M9 12h6"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  drop: '<svg viewBox="0 0 24 24"><path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/></svg>',
  cheer: '<svg viewBox="0 0 24 24"><path d="M3 10v4h3l9 5V5L6 10z"/><path d="M18 9a4 4 0 0 1 0 6"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
  scale: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M9 9h6"/></svg>',
};
const icon = (k, cls = '') => (ICONS[k] || '').replace('<svg', `<svg class="ic ${cls}"`);

/* ---------- 圖表 ---------- */
function lineChart(series, o = {}) {
  const W = 320, H = o.h || 150, L = 34, R = 10, T = 10, B = 22;
  const all = series.flatMap(s => s.pts); if (all.length < 2) return `<div class="empty">${catSVG('tabby', 'loaf', 46)}<div>資料還不夠畫圖（至少 2 筆）</div></div>`;
  let x0 = Math.min(...all.map(p => p.x)), x1 = Math.max(...all.map(p => p.x)); if (x1 === x0) { x0 -= 1; x1 += 1; }
  let y0 = Math.min(...all.map(p => p.y)), y1 = Math.max(...all.map(p => p.y));
  if (o.goal != null && o.goal > 0) { y0 = Math.min(y0, o.goal); y1 = Math.max(y1, o.goal); }
  const pad = Math.max(o.minPad || 0.5, (y1 - y0) * 0.12); y0 -= pad; y1 += pad;
  const X = x => L + (x - x0) / (x1 - x0) * (W - L - R), Y = y => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let g = '';
  for (let i = 0; i <= 3; i++) { const v = y0 + (y1 - y0) * i / 3; g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#efe9dc"/><text x="${L - 5}" y="${Y(v) + 3.5}" text-anchor="end" font-size="9.5" fill="#9a948a">${r1(v)}</text>`; }
  g += `<text x="${L}" y="${H - 6}" font-size="9.5" fill="#9a948a">${numToMD(x0)}</text><text x="${W - R}" y="${H - 6}" font-size="9.5" fill="#9a948a" text-anchor="end">${numToMD(x1)}</text>`;
  if (o.goal != null && o.goal > 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(o.goal)}" y2="${Y(o.goal)}" stroke="#d2463c" stroke-dasharray="2 4" opacity=".6"/><text x="${W - R}" y="${Y(o.goal) - 4}" font-size="9" fill="#d2463c" text-anchor="end">目標 ${o.goal}</text>`;
  (o.bands || []).forEach(b => { g += `<rect x="${X(b.x0)}" y="${T}" width="${Math.max(2, X(b.x1) - X(b.x0))}" height="${H - T - B}" fill="${b.color}" opacity=".18"/>`; });
  series.forEach(s => {
    if (s.line && s.pts.length > 1) g += `<path d="${s.pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (s.dots) s.pts.forEach(p => { g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.4" fill="${s.color}" opacity="${s.op || 1}"/>`; });
  });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div>`;
}
function macroRow(label, val, target, color, unit = 'g', kind = 'cap') {
  const pct = target > 0 ? clamp(val / target * 100, 0, 100) : 0; const rem = target - val;
  const gap = kind === 'min'
    ? (rem > 0 ? `<span class="gap">差 ${r0(rem)}${unit}</span>` : `<span class="gap ok">已達標</span>`)
    : (rem >= 0 ? `<span class="gap">剩 ${r0(rem)}${unit}</span>` : `<span class="gap over">超出 ${r0(-rem)}${unit}</span>`);
  return `<div class="mac"><div class="lab"><span><b>${label}</b> ${r0(val).toLocaleString()} / ${r0(target).toLocaleString()}${unit}</span>${gap}</div><div class="bar"><i style="width:${pct}%;background:${color}"></i></div></div>`;
}
