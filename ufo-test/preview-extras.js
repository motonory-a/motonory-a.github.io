document.addEventListener('DOMContentLoaded',()=>{
  const data=window.UFO_DATA;
  const sc=document.querySelector('#spot-count');if(sc)sc.textContent=data.spots.length;
  const pc=document.querySelector('#people-count');if(pc)pc.textContent=data.people.length;
  const featuredIds=['senganmori','hakui-cosmo','ufo-line','kofu'];
  const icons={'senganmori':'⛰️','hakui-cosmo':'🪐','ufo-line':'🛣️','kofu':'✨'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.querySelector('#featured-grid').innerHTML=featuredIds.map(id=>data.spots.find(s=>s.id===id)).filter(Boolean).map(s=>`<article class="featured-card"><span class="feature-icon">${icons[s.id]||'🛸'}</span><span class="feature-pref">${esc(s.pref)} ${s.id==='ufo-line'?'<span class="new-badge">NEW</span>':''}</span><h3>${esc(s.name)}</h3><button type="button" data-open-spot="${esc(s.id)}">詳しく見る ↗</button></article>`).join('');
  document.querySelector('#hero-search-form').addEventListener('submit',e=>{
    e.preventDefault();
    const all=document.querySelector('[data-category="all"]');if(all)all.click();
    const search=document.querySelector('#spot-search');search.value=document.querySelector('#hero-search').value;
    search.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#spots').scrollIntoView({behavior:'smooth'});
  });
  document.querySelectorAll('[data-quick-category]').forEach(a=>a.addEventListener('click',()=>{
    const id=a.dataset.quickCategory;
    const ss=document.querySelector('#spot-search');if(ss&&ss.value){ss.value='';ss.dispatchEvent(new Event('input',{bubbles:true}));}
    const hs=document.querySelector('#hero-search');if(hs)hs.value='';
    const chip=document.querySelector(`[data-category="${id}"]`);
    if(chip)chip.click();
  }));
});
