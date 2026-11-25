/* 幽かの地図 — 本体 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rei_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rei_' + k, JSON.stringify(v)); } catch (e) { } }
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const PREFS = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];
  const ROUTE_MAX = 12;

  const S = {
    all: [], byId: new Map(), side: '恐怖', types: new Set(), cats: new Set(), minLevel: 1, pref: '', q: '',
    went: new Set(store.get('went', [])), want: new Set(store.get('want', [])), gassho: new Set(store.get('gassho2', [])),
    route: store.get('route', []), here: null, heat: false, zcat: 'すべて', zi: 0, jtab: 'went'
  };
  const isFuku = s => s.side === '縁起';
  const isIrei = s => s.category === '慰霊の地';

  // ---------- SVG ----------
  const FLAME = '<path class="flame" d="M11 1C13 6 18 9 18 16a7 7 0 01-14 0c0-3 1.5-5 3-6.5 0 2.5 1 4 2.5 4.5C9 10 9.5 5 11 1z" fill="currentColor"/>';
  const BELL = '<path d="M11 4a6 6 0 016 6v5l2 3H3l2-3v-5a6 6 0 016-6z M9 21a2 2 0 004 0 M11 1v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="11" cy="18.5" r="1.3" fill="currentColor"/>';
  const LOTUS = '<path d="M11 6c2 3 2 7 0 10-2-3-2-7 0-10z M11 16c-3-1-6-3-7-7 3 0 6 2 7 7z M11 16c3-1 6-3 7-7-3 0-6 2-7 7z" fill="currentColor"/>';
  const pinSvg = s => {
    if (isIrei(s)) return `<svg viewBox="0 0 22 29" style="--b:5px" aria-hidden="true"><g class="glow">${LOTUS}</g>${LOTUS}<circle cx="11" cy="24" r="1.6" fill="currentColor" opacity=".7"/></svg>`;
    const b = [4, 5, 6, 8, 10][s.level - 1];
    return `<svg viewBox="0 0 22 29" style="--b:${b}px" aria-hidden="true"><g class="glow">${isFuku(s) ? BELL : FLAME}</g>${isFuku(s) ? BELL : FLAME}<circle cx="11" cy="27" r="2" fill="currentColor" opacity=".7"/></svg>`;
  };
  const lvHtml = s => {
    if (isIrei(s)) return '<span class="lbl irei">祈りの場</span><span class="lv-txt irei">怖さの度合いはつけていません</span>';
    const fu = isFuku(s);
    const one = on => fu ? `<svg viewBox="0 0 22 22" class="${on ? 'on' : ''}">${BELL}</svg>` : `<svg viewBox="0 0 22 29" class="${on ? 'on' : ''}">${FLAME}</svg>`;
    let h = ''; for (let i = 1; i <= 5; i++) h += one(i <= s.level);
    return `<span class="lv ${fu ? 'fuku' : ''}" aria-hidden="true">${h}</span><span class="lv-txt ${fu ? 'fuku' : ''}">${fu ? '福の度合い' : '恐怖度'} ${s.level}</span>`;
  };

  // ---------- 地図 ----------
  const landStyle = () => ({ color: css('--fog'), weight: .8, opacity: .55, fillColor: document.documentElement.dataset.mode === 'light' ? '#E3DFD2' : '#1B2C37', fillOpacity: 1 });
  let landLayer;
  let map, cluster, heatLayer, rangeLayer, routeLine, rMap, rLine, tiles;
  const TILE = 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png';
  const ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>';
  function mkTiles(m) { return L.tileLayer(TILE, { attribution: ATTR, maxZoom: 18, maxNativeZoom: 18, minZoom: 5, className: 'gsi' }).addTo(m); }
  function initMap() {
    map = L.map('map', { zoomControl: false, minZoom: 4, maxZoom: 17, worldCopyJump: false }).setView([36.3, 137.5], 5);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    map.createPane('land'); map.getPane('land').style.zIndex = 150;
    fetch('data/japan.json').then(r => r.json()).then(g => { landLayer = L.geoJSON(g, { pane: 'land', interactive: false, style: landStyle }).addTo(map); }).catch(() => { });
    map.attributionControl.addAttribution('境界:地球地図日本(国土地理院)');
    tiles = mkTiles(map);
    cluster = L.markerClusterGroup({
      showCoverageOnHover: false, maxClusterRadius: 50, chunkedLoading: true,
      iconCreateFunction: c => {
        const ms = c.getAllChildMarkers(); const fu = ms.filter(m => isFuku(m.options.spot)).length;
        const k = fu === ms.length ? 'fuku' : fu === 0 ? 'kyofu' : 'mix'; const n = c.getChildCount();
        const z = n < 10 ? 34 : n < 100 ? 42 : 52;
        return L.divIcon({ html: `<div class="cl ${k}" style="width:${z}px;height:${z}px">${n}</div>`, className: '', iconSize: [z, z] });
      }
    });
    rangeLayer = L.layerGroup().addTo(map);
    map.addLayer(cluster);
  }
  function setMode(mode) {
    document.documentElement.dataset.mode = mode; store.set('mode', mode);
    $('#modeBtn').textContent = mode === 'light' ? '暗くする' : '明るくする';
    $('meta[name=theme-color]').content = mode === 'light' ? '#F3F0E7' : '#101B24';
    if (map) { map.removeLayer(tiles); tiles = mkTiles(map); if (landLayer) landLayer.setStyle(landStyle()); render(); }
    if (rMap) { rMap.eachLayer(l => l instanceof L.TileLayer && rMap.removeLayer(l)); mkTiles(rMap); renderRoute(); }
  }

  // ---------- 絞り込み ----------
  function filtered() {
    const q = S.q.trim();
    return S.all.filter(s =>
      (S.side === 'すべて' || s.side === S.side) &&
      (!S.types.size || S.types.has(s.type)) && (!S.cats.size || S.cats.has(s.category)) &&
      s.level >= S.minLevel && (!S.pref || s.pref === S.pref) &&
      (!q || [s.name, s.name_kana, s.pref, s.city, s.legend, s.category, s.type, (s.tags || []).join(' ')].join(' ').includes(q)));
  }
  function render() {
    const list = filtered();
    cluster.clearLayers(); rangeLayer.clearLayers();
    const ms = [];
    for (const s of list) {
      if (s.lat == null) continue;
      if (s.precision === '地域のみ') L.circle([s.lat, s.lng], { radius: 7000, stroke: true, weight: 1, color: css('--fog'), opacity: .5, dashArray: '3 4', fillColor: isFuku(s) ? css('--gold') : css('--oni'), fillOpacity: .08, interactive: false }).addTo(rangeLayer);
      const m = L.marker([s.lat, s.lng], { icon: L.divIcon({ className: `pin ${isIrei(s) ? 'irei' : isFuku(s) ? 'fuku' : 'kyofu'}`, html: pinSvg(s), iconSize: [36, 44], iconAnchor: [18, 40] }), spot: s, title: s.name, alt: s.name, keyboard: true });
      m.on('click', () => openSpot(s.id));
      ms.push(m);
    }
    cluster.addLayers(ms);
    const off = list.length - ms.length;
    $('#count').textContent = `${list.length.toLocaleString()} 件を表示${off ? `(うち${off}件は場所不明のため図鑑のみ)` : ''}`;
    if (S.heat) drawHeat(list);
    tonight(); renderNear();
  }
  function drawHeat(list) {
    if (heatLayer) map.removeLayer(heatLayer);
    const g = {}; list.forEach(s => { if (s.lat == null) return; const k = `${Math.round(s.lat * 2) / 2},${Math.round(s.lng * 2) / 2}`; g[k] = (g[k] || 0) + 1; });
    heatLayer = L.layerGroup(Object.entries(g).map(([k, n]) => { const [a, b] = k.split(',').map(Number); return L.circle([a, b], { radius: 16000 + n * 2200, stroke: false, fillColor: S.side === '縁起' ? css('--gold') : css('--oni'), fillOpacity: Math.min(.04 + n * .018, .3), interactive: false }); })).addTo(map);
  }

  // ---------- 詳細シート ----------
  let lastFocus = null;
  function openSpot(id, push = true) {
    const s = S.byId.get(id); if (!s) return;
    const fu = isFuku(s);
    const story = s.legend || '';
    const hasAddr = s.address && s.precision === '所在地確定';
    const yt = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(s.name + ' ' + (fu ? '' : '心霊'));
    $('#drawerBody').innerHTML = `
      <h2 class="d-name" id="dName">${esc(s.name)}</h2>
      <p class="d-where"><span>${esc(s.pref || '')}${esc(s.city || '')}</span><span>／ ${esc(s.category)}${s.type ? '・' + esc(s.type) : ''}</span><span class="lbl">${esc(s.precision)}</span></p>
      ${hasAddr ? `<p class="d-addr">${esc(s.address)}</p>` : ''}
      <div class="d-meta">${lvHtml(s)}</div>
      <p class="d-help">度合いは編集部の目安です。座標は概略位置を含みます。</p>
      <section class="d-sec"><h3>${isIrei(s) ? 'この地の記憶' : fu ? '福を招く言い伝え' : '伝わる物語'} <span class="lbl">${esc(s.truth)}</span></h3>
        <div class="fog ${story.length > 90 ? 'veiled' : ''}"><p class="d-story">${esc(story)}</p><button class="btn-link fog-btn" type="button">霧を晴らして読む</button></div>
        <p class="d-help">伝承の紹介です。超常現象を確認したものではありません。</p></section>
      ${s.history ? `<section class="d-sec"><h3>この土地の歴史</h3><p class="d-hist">${esc(s.history)}</p>
        ${s.sources && s.sources.length ? `<p class="d-src">資料:${s.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(host(u))} ↗</a>`).join('')}</p>` : ''}</section>` : (s.sources && s.sources.length ? `<p class="d-src">資料:${s.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(host(u))} ↗</a>`).join('')}</p>` : '')}
      ${cautionText(s) ? `<p class="warn">${esc(cautionText(s))}</p>` : ''}
      ${/悲しい出来事/.test(story + (s.history || '')) ? `<p class="d-help">つらい気持ちを抱えているときは、ひとりで抱えずに相談を。<a href="https://www.mhlw.go.jp/mamorouyokokoro/" target="_blank" rel="noopener">まもろうよ こころ(厚生労働省)↗</a></p>` : ''}
      <div class="d-actions">
        <button data-act="went" aria-pressed="${S.went.has(s.id)}">行った</button>
        <button data-act="want" aria-pressed="${S.want.has(s.id)}">気になる</button>
        <button data-act="gassho" class="gassho" aria-pressed="${S.gassho.has(s.id)}">${fu ? '感謝する' : '合掌'}</button>
        <button data-act="route" aria-pressed="${S.route.includes(s.id)}">ルートに追加</button>
        <button data-act="share">共有</button>
        <button data-act="map">地図で見る</button>
      </div>
      <p class="d-count">この端末での記録 ― 行った ${S.went.has(s.id) ? 1 : 0}/ 気になる ${S.want.has(s.id) ? 1 : 0}/ ${fu ? '感謝' : '合掌'} ${S.gassho.has(s.id) ? 1 : 0}</p>
      <section class="d-sec"><h3>動画で見る</h3><p class="d-video"><a href="${yt}" target="_blank" rel="noopener">YouTubeで「${esc(s.name)}」を探す ↗</a></p></section>`;
    $('#drawer').dataset.id = s.id;
    if (!$('#drawer').classList.contains('open')) lastFocus = document.activeElement;
    $('#sheetBack').hidden = false; $('#drawer').hidden = false;
    requestAnimationFrame(() => { $('#drawer').classList.add('open'); $('#drawerClose').focus({ preventScroll: true }); });
    $('#drawerBody').scrollTop = 0;
    if (push) history.replaceState(null, '', '#spot=' + encodeURIComponent(s.id));
  }
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; } };
  function cautionText(s) {
    return { '立入禁止': '立入禁止の場所です。中には入らず、外から静かに。', '私有地': '私有地です。許可なく立ち入らないでください。', '危険': '崩落・転落などの危険があります。近づかないでください。', '営業施設・マナー注意': '営業中の施設です。ほかのお客さんや近隣の方に配慮を。', '参拝可': '祈りの場です。参拝のマナーを守り、公開時間を確かめてから。' }[s.caution] || '';
  }
  function closeDrawer() {
    const d = $('#drawer'); d.classList.remove('open'); $('#sheetBack').hidden = true;
    setTimeout(() => { if (!d.classList.contains('open')) d.hidden = true; }, 450);
    if (location.hash.startsWith('#spot=')) history.replaceState(null, '', '#' + currentView());
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  function onDrawerClick(e) {
    const fb = e.target.closest('.fog-btn'); if (fb) { const f = fb.parentElement; f.classList.add('lifting'); f.classList.remove('veiled'); return; }
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = $('#drawer').dataset.id; const s = S.byId.get(id); const act = b.dataset.act;
    if (act === 'went' || act === 'want' || act === 'gassho') {
      const set = S[act]; const on = !set.has(id); on ? set.add(id) : set.delete(id);
      store.set(act === 'gassho' ? 'gassho2' : act, [...set]); b.setAttribute('aria-pressed', on);
      if (act === 'gassho' && on) { b.classList.remove('glow'); void b.offsetWidth; b.classList.add('glow'); toast(isFuku(s) ? 'ご縁に感謝しました' : '静かに手を合わせました'); }
      $('.d-count').textContent = `この端末での記録 ― 行った ${S.went.has(id) ? 1 : 0}/ 気になる ${S.want.has(id) ? 1 : 0}/ ${isFuku(s) ? '感謝' : '合掌'} ${S.gassho.has(id) ? 1 : 0}`;
      renderJournal();
    } else if (act === 'route') {
      const i = S.route.indexOf(id);
      if (i >= 0) S.route.splice(i, 1); else if (S.route.length >= ROUTE_MAX) { toast(`ルートは${ROUTE_MAX}か所までです`); return; } else S.route.push(id);
      store.set('route', S.route); b.setAttribute('aria-pressed', S.route.includes(id)); renderRoute(); toast(S.route.includes(id) ? 'めぐる道に加えました' : 'めぐる道から外しました');
    } else if (act === 'share') share(s.name + '|幽かの地図', baseUrl() + '#spot=' + encodeURIComponent(id));
    else if (act === 'map') { closeDrawer(); go('map'); if (s.lat != null) setTimeout(() => { $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); map.flyTo([s.lat, s.lng], 13, { duration: .9 }); }, 80); else toast('場所不明のため地図には載っていません'); }
  }
  const baseUrl = () => location.origin + location.pathname;
  async function share(title, url) {
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(url); toast('URLをコピーしました'); } catch (e) { window.prompt('このURLを送ってください', url); }
  }
  let tt; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 2200); }

  // ---------- 今夜の一件 / 近く ----------
  function tonight(force) {
    const pool = filtered().filter(s => !isIrei(s) && s.legend && s.legend.length > 40 && (S.side !== '恐怖' || s.level >= 3));
    const box = $('#tonight'); if (!pool.length) { box.innerHTML = ''; return; }
    if (!force && box.dataset.id && pool.some(s => s.id === box.dataset.id)) return;
    const s = pool[Math.floor(Math.random() * pool.length)];
    box.dataset.id = s.id;
    box.innerHTML = `<div class="t-head"><h2>今夜の一件</h2><button class="btn-link" id="tAgain" type="button">別の物語へ ↻</button></div>
      <div><p class="t-name">${esc(s.name)}</p><p class="t-where">${esc(s.pref || '')}${esc(s.city || '')} ／ ${esc(s.category)}</p>
      <p class="t-story">${esc(s.legend.slice(0, 70))}…</p><button class="btn-sub" data-open="${esc(s.id)}" type="button">物語を読む ↗</button></div>`;
  }
  const dist = (a, b, c, d) => { const R = 6371, r = Math.PI / 180; const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  function renderNear() {
    if (!S.here) return;
    const [la, ln] = S.here;
    const near = filtered().filter(s => s.lat != null).map(s => [s, dist(la, ln, s.lat, s.lng)]).sort((a, b) => a[1] - b[1]).slice(0, 15);
    $('#near').innerHTML = near.map(([s, km]) => `<button class="near-item ${isFuku(s) ? 'fuku' : ''}" data-open="${esc(s.id)}" type="button"><span class="n-km">約${km < 10 ? km.toFixed(1) : Math.round(km)}km ・ ${esc(s.city || s.pref || '')}</span><span class="n-name">${esc(s.name)}</span><span class="n-ex">${esc((s.legend || '').slice(0, 50))}</span></button>`).join('') || '<p class="empty">近くに該当する場所がありません。</p>';
    $('#nearNote').innerHTML = '現在地から近い順です。<br>位置は保存せず、送信もしません。';
  }
  function locate() {
    if (!navigator.geolocation) { toast('この端末では現在地が使えません'); return; }
    toast('現在地を確かめています…');
    navigator.geolocation.getCurrentPosition(p => {
      S.here = [p.coords.latitude, p.coords.longitude]; go('map');
      map.flyTo(S.here, 10, { duration: 1 }); renderNear();
      setTimeout(() => $('.near-sec').scrollIntoView({ behavior: 'smooth' }), 300);
    }, () => toast('現在地を取得できませんでした'), { timeout: 10000, maximumAge: 60000 });
  }

  // ---------- めぐる道 ----------
  function renderRoute() {
    S.route = S.route.filter(id => S.byId.has(id));
    const items = S.route.map(id => S.byId.get(id));
    $('#routeList').innerHTML = items.length ? items.map((s, i) => `<li><span class="r-no">${i + 1}</span><button class="r-name" data-open="${esc(s.id)}" type="button">${esc(s.name)}<small>${esc(s.pref || '')}${esc(s.city || '')}</small></button><span class="r-ops"><button data-mv="-1" data-i="${i}" aria-label="上へ" type="button">↑</button><button data-mv="1" data-i="${i}" aria-label="下へ" type="button">↓</button><button data-rm="${i}" aria-label="外す" type="button">✕</button></span></li>`).join('')
      : '<li class="empty">まだ道は白紙です。地図の詳細から、気になる場所を「ルートに追加」してください。</li>';
    const pts = items.filter(s => s.lat != null).map(s => [s.lat, s.lng]);
    if (routeLine) map.removeLayer(routeLine);
    if (pts.length > 1) routeLine = L.polyline(pts, { color: css('--gold'), weight: 2, dashArray: '6 7', opacity: .85 }).addTo(map);
    if (rMap) {
      if (rLine) rMap.removeLayer(rLine);
      rLine = L.layerGroup([L.polyline(pts, { color: css('--gold'), weight: 2, dashArray: '6 7' }), ...pts.map((p, i) => L.marker(p, { icon: L.divIcon({ className: '', html: `<div class="cl fuku" style="width:24px;height:24px;font-size:12px">${i + 1}</div>`, iconSize: [24, 24] }) }))]).addTo(rMap);
      if (pts.length) rMap.fitBounds(pts, { padding: [30, 30], maxZoom: 12 });
    }
  }
  function routeImage() {
    const items = S.route.map(id => S.byId.get(id)).slice(0, 8);
    if (!items.length) { toast('まず場所を追加してください'); return; }
    const c = document.createElement('canvas'); c.width = 1200; c.height = 630; const g = c.getContext('2d');
    g.fillStyle = '#101B24'; g.fillRect(0, 0, 1200, 630);
    g.strokeStyle = '#718D9B'; g.lineWidth = 1; g.strokeRect(40.5, 40.5, 1120, 550);
    const serif = '"Noto Serif JP", serif', sans = '"Noto Sans JP", sans-serif';
    g.fillStyle = '#A9BCC3'; g.font = `18px ${sans}`; g.fillText('幽かの地図 ― 日本全国 心霊・縁起案内', 80, 91);
    g.fillStyle = '#E8EDEA'; g.font = `500 40px ${serif}`; g.fillText('今夜、たどる道。', 80, 155);
    items.forEach((s, i) => {
      const x = i < 4 ? 80 : 630, y = 225 + (i % 4) * 72;
      g.fillStyle = '#D8BC7C'; g.font = `500 26px ${serif}`; g.fillText(String(i + 1), x, y + 4);
      g.fillStyle = '#E8EDEA'; g.font = `500 22px ${sans}`; g.fillText(s.name.slice(0, 20), x + 40, y);
      g.fillStyle = '#A9BCC3'; g.font = `14px ${sans}`; g.fillText(((s.pref || '') + (s.city || '')).slice(0, 24), x + 40, y + 24);
    });
    g.fillStyle = '#A9BCC3'; g.font = `15px ${sans}`; g.fillText('立入禁止・私有地には入らず、近隣の暮らしに配慮を。', 80, 556);
    c.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'kasuka-route.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }, 'image/png');
  }

  // ---------- 記録帳 ----------
  function renderJournal() {
    const went = [...S.went].filter(id => S.byId.has(id));
    const prefsGot = new Set(went.map(id => S.byId.get(id).pref));
    $('#jStats').innerHTML = `<div><b>${went.length}</b>訪ねた場所</div><div><b>${S.want.size}</b>気になる</div><div><b>${S.gassho.size}</b>合掌</div><div><b>${prefsGot.size}</b>/ 47 都道府県の足あと</div>`;
    $$('.j-tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.j === S.jtab));
    const ids = [...S[S.jtab]].filter(id => S.byId.has(id));
    $('#jList').innerHTML = ids.length ? ids.map(id => { const s = S.byId.get(id); return `<li><button data-open="${esc(id)}" type="button">${esc(s.name)}<small>${esc(s.pref || '')}${esc(s.city || '')}</small></button></li>`; }).join('') : '<li class="empty">記録は、ここから。詳細のボタンを押すと帳面に残ります。</li>';
    const cnt = {}; S.all.forEach(s => { if (s.pref) cnt[s.pref] = (cnt[s.pref] || 0) + 1; });
    const wc = {}; went.forEach(id => { const p = S.byId.get(id).pref; wc[p] = (wc[p] || 0) + 1; });
    $('#jPrefNote').textContent = `訪ねた都道府県 ${prefsGot.size} / 47(${Math.round(prefsGot.size / 47 * 100)}%)。各県の数字は、この地図に収録した場所を母数にしています。`;
    $('#jPrefs').innerHTML = PREFS.map(p => `<div class="stamp ${wc[p] ? 'got' : ''}">${p}<small>${cnt[p] ? `${wc[p] || 0} / ${cnt[p]}件` : '未収録'}</small></div>`).join('');
  }

  // ---------- 図鑑 ----------
  const ZCATS = { 'すべて': () => true, '呪物': s => s.category === '呪物', '妖怪': s => s.category === '怪異・妖怪伝承', '怪異': s => s.category === '都市伝説' || s.category === '呪いの伝承', '座敷童': s => s.category === '座敷童', '縁起物': s => s.category === '縁起物' || s.category === '福の伝承', '場所不明': s => s.lat == null };
  let zList = [];
  function renderZukan() {
    $('#zukanTabs').innerHTML = Object.keys(ZCATS).map(k => `<button role="tab" data-z="${k}" aria-selected="${k === S.zcat}" type="button">${k}</button>`).join('');
    const base = S.zcat === 'すべて' ? S.all.filter(s => ['呪物', '怪異・妖怪伝承', '都市伝説', '呪いの伝承', '座敷童', '縁起物', '福の伝承'].includes(s.category) || s.lat == null) : S.all.filter(ZCATS[S.zcat]);
    zList = base.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, 'ja'));
    S.zi = Math.min(S.zi, Math.max(zList.length - 1, 0));
    $('#zukanIndex').innerHTML = zList.map((s, i) => `<button data-zi="${i}" class="${i === S.zi ? 'on' : ''}" type="button">${esc(s.name)}</button>`).join('');
    zPage();
  }
  const TATE = { '呪物': '呪を封ず', '怪異・妖怪伝承': '記憶を繙く', '都市伝説': '噂を辿る', '呪いの伝承': '祟りを鎮む', '座敷童': '福を招く', '縁起物': '福を招く', '福の伝承': '福を招く', '心霊スポット': '記憶を繙く' };
  function zPage() {
    const p = $('#zukanPage'); const s = zList[S.zi];
    $('#zNum').textContent = zList.length ? `${S.zi + 1} / ${zList.length} 頁` : '';
    $('#zPrev').disabled = S.zi <= 0; $('#zNext').disabled = S.zi >= zList.length - 1;
    $$('#zukanIndex button').forEach((b, i) => b.classList.toggle('on', i === S.zi));
    if (!s) { p.innerHTML = '<p>この章には、まだ何も綴じられていません。</p>'; return; }
    p.classList.add('turn');
    setTimeout(() => {
      p.innerHTML = `<p class="z-crumb">${esc(s.category)}の頁 ／ ${s.lat == null ? '所在不明' : esc((s.pref || '') + (s.city || ''))}</p>
      <h3 class="z-name">${esc(s.name)}</h3>
      <div class="z-body"><p class="z-tate" aria-hidden="true">${TATE[s.category] || '記憶を繙く'}</p>
      <div><span class="lbl">${esc(s.precision)}</span> <span class="lbl">${esc(s.truth)}</span>
      <p>${esc(s.legend || '')}</p>${s.history ? `<p class="z-hist">${esc(s.history)}</p>` : ''}
      <button class="btn-link" data-open="${esc(s.id)}" type="button">この物語を詳しく読む ↗</button></div></div>`;
      p.classList.remove('turn');
    }, 180);
  }

  // ---------- ページ切替 ----------
  const VIEWS = ['map', 'zukan', 'route', 'journal'];
  const currentView = () => VIEWS.find(v => !$('#v-' + v).hidden) || 'map';
  function go(v) {
    if (!VIEWS.includes(v)) v = 'map';
    VIEWS.forEach(x => { $('#v-' + x).hidden = x !== v; });
    $$('[data-view]').forEach(a => { if (a.tagName === 'A') a.classList.toggle('on', a.dataset.view === v); });
    if (v === 'map') setTimeout(() => map.invalidateSize(), 50);
    if (v === 'route') {
      if (!rMap) { rMap = L.map('routeMap', { zoomControl: true, attributionControl: true }).setView([36.3, 137.5], 4); mkTiles(rMap); }
      setTimeout(() => { rMap.invalidateSize(); renderRoute(); }, 60);
    }
    if (v === 'zukan') renderZukan();
    if (v === 'journal') renderJournal();
  }
  function onHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('spot=')) { const s = S.byId.get(h.slice(5)); if (s) { if (currentView() !== 'map' && s.lat != null) go('map'); openSpot(s.id, false); } return; }
    if (h.startsWith('route=')) { S.route = h.slice(6).split(',').filter(id => S.byId.has(id)).slice(0, ROUTE_MAX); store.set('route', S.route); go('route'); toast('共有されたルートを開きました'); return; }
    go(h || 'map'); window.scrollTo(0, 0);
  }

  // ---------- 起動 ----------
  async function boot() {
    initMap();
    $('#modeBtn').textContent = document.documentElement.dataset.mode === 'light' ? '暗くする' : '明るくする';
    try { S.all = await (await fetch('data/spots.json', { cache: 'no-cache' })).json(); } catch (e) { $('#count').textContent = 'データを読み込めませんでした'; return; }
    S.all.forEach(s => S.byId.set(s.id, s));
    const types = [...new Set(S.all.map(s => s.type).filter(Boolean))];
    $('#typeChips').innerHTML = types.map(t => `<button data-type="${esc(t)}" aria-pressed="false" type="button">${esc(t)}</button>`).join('');
    const cats = ['慰霊の地', '心霊スポット', '呪いの伝承', '呪物', '怪異・妖怪伝承', '都市伝説', '座敷童', '福の伝承', '縁起物'];
    $('#catChips').innerHTML = cats.map(t => `<button data-cat="${t}" aria-pressed="false" type="button">${t}</button>`).join('');
    $('#prefSel').innerHTML = '<option value="">全国</option>' + PREFS.map(p => `<option>${p}</option>`).join('');
    render(); renderRoute(); renderJournal();

    document.addEventListener('click', e => {
      const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openSpot(o.dataset.open); return; }
      if (e.target.closest('#tAgain')) { tonight(true); return; }
      const z = e.target.closest('[data-z]'); if (z) { S.zcat = z.dataset.z; S.zi = 0; renderZukan(); return; }
      const zi = e.target.closest('[data-zi]'); if (zi) { S.zi = +zi.dataset.zi; zPage(); $('.z-book').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const mv = e.target.closest('[data-mv]'); if (mv) { const i = +mv.dataset.i, j = i + +mv.dataset.mv; if (j >= 0 && j < S.route.length) { [S.route[i], S.route[j]] = [S.route[j], S.route[i]]; store.set('route', S.route); renderRoute(); } return; }
      const rm = e.target.closest('[data-rm]'); if (rm) { S.route.splice(+rm.dataset.rm, 1); store.set('route', S.route); renderRoute(); return; }
      const jb = e.target.closest('[data-j]'); if (jb) { S.jtab = jb.dataset.j; renderJournal(); return; }
    });
    $$('[data-side]').forEach(b => b.addEventListener('click', () => {
      S.side = b.dataset.side; $$('[data-side]').forEach(x => x.setAttribute('aria-selected', x === b));
      document.documentElement.dataset.side = S.side; $('#tonight').dataset.id = ''; render();
    }));
    $('#typeChips').addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (!b) return; const t = b.dataset.type; S.types.has(t) ? S.types.delete(t) : S.types.add(t); b.setAttribute('aria-pressed', S.types.has(t)); render(); });
    $('#catChips').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; const t = b.dataset.cat; S.cats.has(t) ? S.cats.delete(t) : S.cats.add(t); b.setAttribute('aria-pressed', S.cats.has(t)); render(); });
    $('#levelSel').addEventListener('change', e => { S.minLevel = +e.target.value; render(); });
    $('#prefSel').addEventListener('change', e => { S.pref = e.target.value; render(); const f = filtered().filter(s => s.lat != null); if (f.length) map.fitBounds(f.map(s => [s.lat, s.lng]), { maxZoom: 10, padding: [30, 30] }); else map.setView([36.3, 137.5], 5); });
    let t; $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { S.q = e.target.value; render(); }, 250); });
    $('#filterToggle').addEventListener('click', e => { const f = $('#filters'); f.hidden = !f.hidden; e.currentTarget.setAttribute('aria-expanded', !f.hidden); e.currentTarget.querySelector('span').textContent = f.hidden ? '＋' : '－'; });
    $('#resetBtn').addEventListener('click', () => { S.types.clear(); S.cats.clear(); S.minLevel = 1; S.pref = ''; S.q = ''; $('#q').value = ''; $('#prefSel').value = ''; $('#levelSel').value = '1'; $$('[data-type],[data-cat]').forEach(b => b.setAttribute('aria-pressed', 'false')); render(); });
    $('#heatBtn').addEventListener('click', e => { S.heat = !S.heat; e.currentTarget.setAttribute('aria-pressed', S.heat); e.currentTarget.querySelector('span').textContent = S.heat ? '入' : '切'; if (S.heat) drawHeat(filtered()); else if (heatLayer) map.removeLayer(heatLayer); });
    $('#allBtn').addEventListener('click', () => map.flyTo([36.3, 137.5], 5, { duration: .8 }));
    $('#modeBtn').addEventListener('click', () => setMode(document.documentElement.dataset.mode === 'light' ? 'dark' : 'light'));
    $$('[data-locate]').forEach(b => b.addEventListener('click', locate));
    $('#drawer').addEventListener('click', onDrawerClick);
    $('#drawerClose').addEventListener('click', closeDrawer);
    $('#sheetBack').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer(); });
    $('#routeShare').addEventListener('click', () => S.route.length ? share('めぐる道|幽かの地図', baseUrl() + '#route=' + S.route.map(encodeURIComponent).join(',')) : toast('まず場所を追加してください'));
    $('#routeImg').addEventListener('click', () => document.fonts.ready.then(routeImage));
    $('#routeClear').addEventListener('click', () => { S.route = []; store.set('route', []); renderRoute(); });
    $('#zPrev').addEventListener('click', () => { if (S.zi > 0) { S.zi--; zPage(); } });
    $('#zNext').addEventListener('click', () => { if (S.zi < zList.length - 1) { S.zi++; zPage(); } });
    window.addEventListener('hashchange', onHash);
    onHash();
  }
  document.addEventListener('DOMContentLoaded', boot);
})();
