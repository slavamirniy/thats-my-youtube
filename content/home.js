// Home page
async function createHomePage() {
  if (document.getElementById('tmy-app')) return;
  const app = document.createElement('div');
  app.id = 'tmy-app';
  app.innerHTML = `
<div class="tmy-container">
  <header class="tmy-head"><div class="tmy-logo"><span class="tmy-icon"></span><h1>That's My YouTube</h1></div>
    <nav class="tmy-nav"><button data-action="notes">Конспекты</button><button data-action="settings">⚙</button></nav>
  </header>
  <section class="tmy-history" id="tmy-history" style="display:none"><h3>Продолжить</h3><div class="tmy-hgrid"></div></section>
  <div class="tmy-tabs-wrap">
    <button class="tmy-tabs-arr" id="tmy-tabs-left">◀</button>
    <nav class="tmy-tabs" id="tmy-tabs"></nav>
    <button class="tmy-tabs-arr" id="tmy-tabs-right">▶</button>
  </div>
  <section class="tmy-main"><div class="tmy-mhead"><span id="tmy-ptitle">Смотреть позже</span><span id="tmy-count">0</span></div>
    <div class="tmy-grid" id="tmy-grid"></div><div class="tmy-load" id="tmy-load">Загрузка</div>
  </section>
</div>
<div class="tmy-page" id="tmy-notespage" style="display:none">
  <div class="tmy-page-head">
    <button class="tmy-back" id="tmy-notes-back">← Назад</button>
    <h2>Мои конспекты</h2>
    <div class="tmy-page-actions">
      <button class="tmy-btn" id="tmy-folder">📁 Папка</button>
      <button class="tmy-btn" id="tmy-export">⬇ Экспорт</button>
    </div>
  </div>
  <div id="tmy-fstatus" class="tmy-fstatus"></div>
  <div id="tmy-nlist" class="tmy-nlist"></div>
</div>
<div class="tmy-overlay" id="tmy-settings" style="display:none">
  <div class="tmy-sbox">
    <div class="tmy-shead"><h2>Настройки</h2><button class="tmy-x" id="tmy-sclose">&times;</button></div>
    <div class="tmy-sbody">
      <label>Папка для конспектов (Obsidian)</label>
      <p>После перезагрузки нужно выбрать папку снова (ограничение браузера)</p>
      <button class="tmy-btn" id="tmy-pickfolder">Выбрать папку</button>
      <span id="tmy-fpath"></span>
    </div>
  </div>
</div>`;
  document.body.appendChild(app);
  
  const settings = await sendMessage({ type: 'getSettings' });
  const fp = document.getElementById('tmy-fpath');
  if (settings?.obsidianFolder) {
    fp.textContent = settings.obsidianFolder + ' (нужно выбрать снова)';
  }
  
  setupHomeEvents();
  await loadHistory();
  await loadTabs();
  await loadVideos('WL');
}

function setupHomeEvents() {
  const $ = s => document.querySelector(s);
  $('[data-action="notes"]').onclick = openNotesPage;
  $('[data-action="settings"]').onclick = () => $('#tmy-settings').style.display = 'flex';
  $('#tmy-sclose').onclick = () => $('#tmy-settings').style.display = 'none';
  $('#tmy-notes-back').onclick = closeNotesPage;
  $('#tmy-folder').onclick = pickFolder;
  $('#tmy-pickfolder').onclick = pickFolder;
  $('#tmy-export').onclick = exportAll;
  
  $('#tmy-grid').onclick = (e) => { const c = e.target.closest('[data-id]'); if (c) goToVideo(c.dataset.id, c.dataset.title); };
  $('.tmy-hgrid').onclick = (e) => { const c = e.target.closest('[data-id]'); if (c) goToVideo(c.dataset.id, c.dataset.title); };
  $('#tmy-settings').onclick = (e) => { if (e.target.id === 'tmy-settings') $('#tmy-settings').style.display = 'none'; };
  
  document.onkeydown = (e) => {
    if (e.key === 'Escape') {
      if ($('#tmy-notespage').style.display !== 'none') closeNotesPage();
      else if ($('#tmy-settings').style.display !== 'none') $('#tmy-settings').style.display = 'none';
    }
  };
}

function goToVideo(id, title) {
  sendMessage({ type: 'addToHistory', video: { id, title, thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } });
  window.location.href = `https://www.youtube.com/watch?v=${id}`;
}

async function loadHistory() {
  const r = await sendMessage({ type: 'getHistory' });
  const h = r?.history || [];
  const sec = document.getElementById('tmy-history');
  const grid = document.querySelector('.tmy-hgrid');
  if (!h.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  grid.innerHTML = h.slice(0, 10).map(v => `<div class="tmy-hcard" data-id="${v.id}" data-title="${escapeHtml(v.title)}"><img src="${v.thumbnail}"><span>${escapeHtml(v.title)}</span></div>`).join('');
}

async function loadTabs() {
  const tabs = document.getElementById('tmy-tabs');
  const leftArr = document.getElementById('tmy-tabs-left');
  const rightArr = document.getElementById('tmy-tabs-right');
  
  tabs.innerHTML = `<button class="tmy-tab active" data-pl="WL">Смотреть позже</button><span class="tmy-tabs-loading">...</span>`;
  
  const ytPlaylists = await fetchUserPlaylists();
  const saved = (await sendMessage({ type: 'getPlaylists' }))?.playlists || [];
  const allPlaylists = [...ytPlaylists];
  for (const s of saved) { if (!allPlaylists.find(p => p.id === s.id)) allPlaylists.push(s); }
  
  tabs.innerHTML = `<button class="tmy-tab active" data-pl="WL">Смотреть позже</button>${allPlaylists.map(x => `<button class="tmy-tab" data-pl="${x.id}">${escapeHtml(x.name)}</button>`).join('')}`;
  
  // Scroll arrows
  const scrollAmount = 200;
  leftArr.onclick = () => { tabs.scrollBy({ left: -scrollAmount, behavior: 'smooth' }); };
  rightArr.onclick = () => { tabs.scrollBy({ left: scrollAmount, behavior: 'smooth' }); };
  
  tabs.onclick = (e) => {
    const tab = e.target.closest('.tmy-tab');
    if (tab && tab.dataset.pl !== TMY.currentPlaylistId) {
      document.querySelectorAll('.tmy-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      TMY.currentPlaylistId = tab.dataset.pl;
      document.getElementById('tmy-ptitle').textContent = tab.textContent.trim();
      loadVideos(TMY.currentPlaylistId);
    }
  };
}

async function loadVideos(plId) {
  const grid = document.getElementById('tmy-grid');
  const load = document.getElementById('tmy-load');
  const count = document.getElementById('tmy-count');
  grid.innerHTML = ''; load.style.display = 'block'; load.textContent = '0';
  
  TMY.allVideos = await fetchAllVideos(plId, (n, more) => {
    load.textContent = `${n}${more ? '...' : ''}`;
    count.textContent = n;
  });
  
  load.style.display = 'none';
  count.textContent = TMY.allVideos.length;
  if (!TMY.allVideos.length) { grid.innerHTML = '<div class="tmy-empty">Пусто или требуется авторизация</div>'; return; }
  await renderGrid();
}

async function renderGrid() {
  const notes = (await sendMessage({ type: 'getAllNotes' }))?.notes || {};
  document.getElementById('tmy-grid').innerHTML = TMY.allVideos.map((v, i) => `
    <div class="tmy-card" data-id="${v.id}" data-title="${escapeHtml(v.title)}" style="animation-delay:${Math.min(i, 20) * 15}ms">
      <div class="tmy-thumb"><img src="${v.thumbnail}" loading="lazy">${v.duration ? `<span class="tmy-dur">${v.duration}</span>` : ''}</div>
      <div class="tmy-info"><div class="tmy-title">${escapeHtml(v.title)}</div><div class="tmy-ch">${escapeHtml(v.channel)}</div>${notes[v.id] ? '<span class="tmy-badge">📝</span>' : ''}</div>
    </div>`).join('');
}
