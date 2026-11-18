(() => {
  'use strict';
  const dataset = window.UFO_DATA;
  if (!dataset) return;
  const spots = dataset.spots;
  const people = dataset.people;
  const categoryMap = Object.fromEntries(dataset.categories.map(x => [x.id,x.label]));
  const statusMap = {official:'自治体・公式の記録',press:'取材・報道あり',archive:'民間資料・研究記録',unverified:'真偽不明（あやしい話）'};
  const kindSymbols = {observe:'✦',event:'◉',case:'◈',legend:'◇',facility:'⌂',phenomenon:'✧',rumor:'？'};
  const state = {category:'all',search:'',visitOnly:false,hideUnverified:false,view:'map',userLocation:null};
  let map = null;
  let markers = null;
  let circles = null;

  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const escapeAttr = escapeHtml;
  const openExternal = (url,label) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
  const hasCoordinates = spot => Number.isFinite(spot.lat) && Number.isFinite(spot.lng);
  const googleMapsUrl = spot => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.mapSearchQuery || spot.address.replace(/（[^）]*）/g,'').trim())}`;

  function showToast(message){const toast=$('#toast');toast.textContent=message;toast.classList.add('is-visible');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('is-visible'),3000)}

  function getFiltered() {
    const query=state.search.toLocaleLowerCase('ja').trim();
    let result=spots.filter(spot => (state.category==='all'||spot.kind===state.category)
      &&(!state.visitOnly||spot.visit==='public')&&(!state.hideUnverified||spot.status!=='unverified')
      &&(!query||[spot.name,spot.pref,spot.city,spot.lead,spot.era,spot.story].join(' ').toLocaleLowerCase('ja').includes(query)));
    if(state.userLocation) result.sort((a,b)=>distance(state.userLocation,a)-distance(state.userLocation,b));
    else result.sort((a,b)=>Number(Boolean(b.featured))-Number(Boolean(a.featured)));
    return result;
  }

  function distance(origin,spot){if(!hasCoordinates(spot)){if(!spot.area)return Infinity;spot={lat:spot.area.lat,lng:spot.area.lng}}const rad=Math.PI/180;const dlat=(spot.lat-origin.lat)*rad;const dlng=(spot.lng-origin.lng)*rad;const t=Math.sin(dlat/2)**2+Math.cos(origin.lat*rad)*Math.cos(spot.lat*rad)*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(t),Math.sqrt(1-t))}

  function renderCategories(){
    $('#filter-chips').innerHTML=dataset.categories.map(c=>`<button class="chip ${state.category===c.id?'is-active':''}" type="button" data-category="${c.id}" aria-pressed="${state.category===c.id}">${escapeHtml(c.label)}</button>`).join('');
  }

  function renderSpotCard(spot){
    return `<article class="spot-card">
      <div class="spot-card-top" data-kind="${spot.kind}"><div class="spot-tags"><span class="spot-tag">${escapeHtml(categoryMap[spot.kind])}</span><span class="spot-tag">${escapeHtml(spot.era)}</span></div><h3>${escapeHtml(spot.name)}</h3></div>
      <div class="spot-card-body"><div class="spot-location">⌖ ${escapeHtml(spot.pref)} ${escapeHtml(spot.city)}</div>${!hasCoordinates(spot)?'<div class="region-badge">地図ピンなし・地域単位で表示</div>':''}<p>${escapeHtml(spot.lead)}</p><div class="spot-card-foot"><span class="source-badge" data-status="${spot.status}">${escapeHtml(statusMap[spot.status])}</span><button type="button" data-open-spot="${escapeAttr(spot.id)}">詳しく見る ↗</button></div></div>
    </article>`;
  }

  function renderSpots(){
    const filtered=getFiltered();
    $('#spot-count').textContent=String(spots.length).padStart(2,'0');
    $('#result-count').textContent=`${filtered.length}件を表示中${state.userLocation?' ／ 現在地に近い順':''}`;
    $('#spot-list').innerHTML=filtered.length?filtered.map(renderSpotCard).join(''):'<div class="empty-state"><b>一致するスポットがありません</b>検索語やジャンルを変えてみてください。</div>';
    $('#spot-list').hidden=false;
    $('#spot-map-wrapper').hidden=state.view!=='map';
    $('#list-button').classList.toggle('is-active',state.view==='list');
    $('#map-button').classList.toggle('is-active',state.view==='map');
    $('#list-button').setAttribute('aria-pressed',String(state.view==='list'));
    $('#map-button').setAttribute('aria-pressed',String(state.view==='map'));
    if(state.view==='map') renderMap(filtered);
  }

  function renderRegionOnly(visible){
    const areaSpots=visible.filter(spot=>!hasCoordinates(spot)&&!spot.area);
    $('#map-region-list').innerHTML=areaSpots.length
      ? `<div class="region-panel"><h3>⌖ 地域単位で表示するスポット（${areaSpots.length}件）</h3><p>正確な地点を確認していないため、地図上にピンは置いていません。</p><div class="region-cards">${areaSpots.map(spot=>`<article class="region-card"><strong>${escapeHtml(spot.name)}</strong><span>${escapeHtml(spot.pref)} ${escapeHtml(spot.city)}</span><div><button type="button" data-open-spot="${escapeAttr(spot.id)}">詳細を見る</button>${openExternal(googleMapsUrl(spot),'Googleマップで地域を検索')}</div></article>`).join('')}</div></div>`
      : '';
  }

  function renderOfflineMap(visible){
    const pins=$('#offline-map-pins');
    pins.innerHTML=visible.map(spot=>{
      const x=(spot.lng-127.5)/(147-127.5)*100;
      const y=(46.5-spot.lat)/(46.5-29.5)*100;
      return `<button class="fallback-pin ${escapeAttr(spot.kind)}" type="button" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" data-open-spot="${escapeAttr(spot.id)}" title="${escapeAttr(spot.name)}" aria-label="${escapeAttr(spot.name)}の詳細を表示">${kindSymbols[spot.kind]||'✦'}</button>`;
    }).join('');
  }

  function renderMap(visible){
    renderRegionOnly(visible);
    const pinSpots=visible.filter(hasCoordinates);
    if(!window.L){
      $('#map-fallback').hidden=false;
      $('#spot-map').style.display='none';
      renderOfflineMap(pinSpots.concat(visible.filter(s=>!hasCoordinates(s)&&s.area).map(s=>({...s,lat:s.area.lat,lng:s.area.lng}))));
      return;
    }
    $('#map-fallback').hidden=true;
    $('#spot-map').style.display='block';
    if(!map){
      map=L.map('spot-map',{scrollWheelZoom:false}).setView([37.2,137.8],5);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
      markers=(L.markerClusterGroup?L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:40,spiderfyOnMaxZoom:true}):L.layerGroup()).addTo(map);
      circles=L.layerGroup();
      const syncCircles=()=>{if(map.getZoom()>=7){if(!map.hasLayer(circles))circles.addTo(map)}else if(map.hasLayer(circles))map.removeLayer(circles)};
      map.on('zoomend',syncCircles);setTimeout(syncCircles,300);
    }
    markers.clearLayers();circles.clearLayers();
    const bounds=[];
    pinSpots.forEach(spot=>{
      const icon=L.divIcon({html:`<div class="ufo-pin ${spot.kind}"><span>${kindSymbols[spot.kind]||'✦'}</span></div>`,className:'',iconSize:[28,28],iconAnchor:[14,26]});
      const marker=L.marker([spot.lat,spot.lng],{icon}).addTo(markers);
      marker.bindPopup(`<div class="map-popup"><h4>${escapeHtml(spot.name)}</h4><p>${escapeHtml(spot.pref)} ${escapeHtml(spot.city)}<br>位置は目安です</p><button type="button" data-open-spot="${escapeAttr(spot.id)}">詳細を見る ↗</button></div>`);
      bounds.push([spot.lat,spot.lng]);
    });
    visible.filter(spot=>!hasCoordinates(spot)&&spot.area).forEach(spot=>{
      const a=spot.area;
      const circle=L.circle([a.lat,a.lng],{radius:a.radiusKm*1000,color:'#ffd98a',weight:2,dashArray:'6 6',fillColor:'#9a43f8',fillOpacity:.18}).addTo(circles);
      const icon=L.divIcon({html:`<div class="ufo-pin area-pin ${spot.kind}"><span>${kindSymbols[spot.kind]||'✦'}</span></div>`,className:'',iconSize:[24,24],iconAnchor:[12,12]});
      const marker=L.marker([a.lat,a.lng],{icon}).addTo(markers);
      const pop=`<div class="map-popup"><h4>${escapeHtml(spot.name)}</h4><p>${escapeHtml(spot.pref)} ${escapeHtml(spot.city)}<br>点線の円は「このあたり」の目安です。正確な場所ではありません。</p><button type="button" data-open-spot="${escapeAttr(spot.id)}">詳細を見る ↗</button></div>`;
      marker.bindPopup(pop);circle.bindPopup(pop);
      bounds.push([a.lat,a.lng]);
    });
    setTimeout(()=>{map.invalidateSize();if(bounds.length===1)map.setView(bounds[0],9);else if(bounds.length>1)map.fitBounds(bounds,{padding:[30,30],maxZoom:10})},100);
  }

  function renderPeople(){
    $('#people-grid').innerHTML=people.map(person=>`<article class="person-card"><div class="person-head"><div class="person-avatar ${escapeAttr(person.color)}" aria-hidden="true">${escapeHtml(person.initial)}</div><div><span class="person-role">${escapeHtml(person.role)} ｜ ${escapeHtml(person.area)}</span><h3>${escapeHtml(person.name)}</h3><span class="person-kana">${escapeHtml(person.kana)}</span></div></div><p>${escapeHtml(person.bio)}</p><div class="person-record"><span>PUBLIC ACTIVITY / 活動実績</span><p>${escapeHtml(person.record)}</p></div><div class="person-links"><a class="primary-contact" href="${escapeAttr(person.contactUrl)}" ${person.contactUrl.startsWith('http')?'target="_blank" rel="noopener noreferrer"':''}>${escapeHtml(person.contactLabel)} ↗</a>${openExternal(person.sourceUrl,'活動の出典')}</div><div class="person-note">※ ${escapeHtml(person.note)}</div></article>`).join('');
  }

  function openSpot(id){
    const spot=spots.find(item=>item.id===id);if(!spot)return;
    $('#dialog-tag').textContent=categoryMap[spot.kind].toUpperCase();
    $('#dialog-pref').textContent=`${spot.pref} / ${spot.era} / ${statusMap[spot.status]}`;
    $('#dialog-title').textContent=spot.name;
    $('#dialog-lead').textContent=spot.lead;
    $('#dialog-story').textContent=spot.story;
    $('#dialog-access').textContent=spot.access;
    $('#dialog-address').textContent=spot.address;
    $('#dialog-region-note').hidden=hasCoordinates(spot);
    $('#dialog-region-note').textContent=hasCoordinates(spot)?'':'正確な場所は確かめられていません。地図では点線の円で「このあたり」の目安を示しています。';
    $('#dialog-links').innerHTML=spot.sources.map(s=>openExternal(s[1],s[0])).join('')+`<a class="map-link" href="${escapeAttr(googleMapsUrl(spot))}" target="_blank" rel="noopener noreferrer">地図アプリで地域を確認 ↗</a>`;
    $('#spot-dialog').showModal();
  }

  function init(){
    renderCategories();renderSpots();renderPeople();
    $('#filter-chips').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(!button)return;state.category=button.dataset.category;renderCategories();renderSpots()});
    $('#spot-search').addEventListener('input',event=>{state.search=event.target.value;renderSpots()});
    $('#visit-only').addEventListener('change',event=>{state.visitOnly=event.target.checked;renderSpots()});const hu=$('#hide-unverified');if(hu)hu.addEventListener('change',event=>{state.hideUnverified=event.target.checked;renderSpots()});
    $('#list-button').addEventListener('click',()=>{state.view='list';renderSpots()});
    $('#map-button').addEventListener('click',()=>{state.view='map';renderSpots()});
    document.addEventListener('click',event=>{const button=event.target.closest('[data-open-spot]');if(button)openSpot(button.dataset.openSpot)});
    $('#dialog-close').addEventListener('click',()=>$('#spot-dialog').close());
    $('#spot-dialog').addEventListener('click',event=>{if(event.target===$('#spot-dialog'))$('#spot-dialog').close()});
    const navToggle=$('#nav-toggle');const mobileNav=$('#mobile-nav');navToggle.addEventListener('click',()=>{const isOpen=navToggle.getAttribute('aria-expanded')==='true';navToggle.setAttribute('aria-expanded',String(!isOpen));navToggle.setAttribute('aria-label',isOpen?'メニューを開く':'メニューを閉じる');mobileNav.hidden=isOpen});
    mobileNav.addEventListener('click',event=>{if(event.target.closest('a')){mobileNav.hidden=true;navToggle.setAttribute('aria-expanded','false')}});
    const nearButton=document.createElement('button');nearButton.type='button';nearButton.id='near-button';nearButton.className='near-button';nearButton.textContent='⌖ 現在地から近い順';nearButton.title='位置情報はサイトに保存しません';
    $('#result-count').insertAdjacentElement('afterend',nearButton);
    nearButton.addEventListener('click',()=>{if(state.userLocation){state.userLocation=null;nearButton.textContent='⌖ 現在地から近い順';renderSpots();return}if(!navigator.geolocation){showToast('このブラウザでは位置情報を利用できません');return}nearButton.disabled=true;nearButton.textContent='位置を確認中…';navigator.geolocation.getCurrentPosition(position=>{state.userLocation={lat:position.coords.latitude,lng:position.coords.longitude};nearButton.disabled=false;nearButton.textContent='✓ 近い順で表示中（解除）';renderSpots();showToast('現在地に近い順で並べました')},()=>{nearButton.disabled=false;nearButton.textContent='⌖ 現在地から近い順';showToast('位置情報が使えませんでした')},{timeout:9000,maximumAge:60000})});
    if(location.hash.startsWith('#spot='))setTimeout(()=>openSpot(decodeURIComponent(location.hash.slice(6))),100);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
