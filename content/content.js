let researchMode = false;
let homePageCreating = false;
let allVideos = [];
let currentPlaylistId = 'WL';
let currentVideoId = null;
let folderHandle = null;
let autoSaveInterval = null;

// ===== UTILS =====
async function sendMessage(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (r) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(r);
      });
    } catch (e) { resolve(null); }
  });
}

const escapeHtml = (s) => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };

async function checkResearchMode() {
  const r = await sendMessage({ type: 'getResearchMode' });
  researchMode = r?.researchMode || false;
  return researchMode;
}

const isHomePage = () => ['/', '/feed/subscriptions'].includes(location.pathname);
const isVideoPage = () => location.pathname === '/watch';
const isPlaylistPage = () => location.pathname === '/playlist';
const getVideoId = () => new URLSearchParams(location.search).get('v');

// ===== FETCH USER PLAYLISTS =====
async function fetchUserPlaylists() {
  try {
    const r = await fetch('https://www.youtube.com/feed/playlists', { credentials: 'include' });
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*({.*?});/s);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const playlists = [];
    const items = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents || [];
    for (const item of items) {
      const lockup = item?.richItemRenderer?.content?.lockupViewModel || item?.richItemRenderer?.content?.playlistRenderer;
      if (!lockup) continue;
      const contentId = lockup.contentId;
      const metadata = lockup.metadata?.lockupMetadataViewModel;
      const title = metadata?.title?.content;
      if (contentId && title && !contentId.startsWith('WL') && !contentId.startsWith('LL')) {
        playlists.push({ id: contentId, name: title });
      }
      if (lockup.playlistId && lockup.title?.simpleText) {
        playlists.push({ id: lockup.playlistId, name: lockup.title.simpleText });
      }
    }
    return playlists;
  } catch (e) { return []; }
}

// ===== FETCH ALL VIDEOS =====
async function fetchAllVideos(playlistId, onProgress) {
  let videos = [], cont = null, page = 0;
  const first = await fetchPage(playlistId, null);
  videos = first.videos;
  cont = first.cont;
  onProgress?.(videos.length, !!cont);
  
  while (cont && page < 100) {
    page++;
    await new Promise(r => setTimeout(r, 200));
    const next = await fetchPage(playlistId, cont);
    if (!next.videos.length) break;
    videos = [...videos, ...next.videos];
    cont = next.cont;
    onProgress?.(videos.length, !!cont);
  }
  return videos;
}

async function fetchPage(playlistId, cont) {
  try {
    if (cont) {
      const r = await fetch('https://www.youtube.com/youtubei/v1/browse', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20241111.00.00', hl: 'ru', gl: 'RU' } },
          continuation: cont
        })
      });
      return parseCont(await r.json());
    }
    const r = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, { credentials: 'include' });
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*({.*?});/s);
    return m ? parseInit(JSON.parse(m[1])) : { videos: [], cont: null };
  } catch (e) { return { videos: [], cont: null }; }
}

function parseInit(data) {
  const videos = [];
  let cont = null;
  const items = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];
  for (const i of items) {
    if (i.continuationItemRenderer) { cont = i.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; continue; }
    const v = i.playlistVideoRenderer;
    if (v?.videoId) videos.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, channel: v.shortBylineText?.runs?.[0]?.text || '', duration: v.lengthText?.simpleText || '' });
  }
  return { videos, cont };
}

function parseCont(data) {
  const videos = [];
  let cont = null;
  const items = data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];
  for (const i of items) {
    if (i.continuationItemRenderer) { cont = i.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; continue; }
    const v = i.playlistVideoRenderer;
    if (v?.videoId) videos.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, channel: v.shortBylineText?.runs?.[0]?.text || '', duration: v.lengthText?.simpleText || '' });
  }
  return { videos, cont };
}

// ===== HOME PAGE =====
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
  <nav class="tmy-tabs" id="tmy-tabs"></nav>
  <section class="tmy-main"><div class="tmy-mhead"><span id="tmy-ptitle">Смотреть позже</span><span id="tmy-count">0</span></div>
    <div class="tmy-grid" id="tmy-grid"></div><div class="tmy-load" id="tmy-load">Загрузка</div>
  </section>
</div>

<!-- Notes Page -->
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

<!-- Settings -->
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
  
  // Load folder status
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
  tabs.innerHTML = `<button class="tmy-tab active" data-pl="WL">Смотреть позже</button><span class="tmy-tabs-loading">...</span>`;
  
  const ytPlaylists = await fetchUserPlaylists();
  const saved = (await sendMessage({ type: 'getPlaylists' }))?.playlists || [];
  const allPlaylists = [...ytPlaylists];
  for (const s of saved) { if (!allPlaylists.find(p => p.id === s.id)) allPlaylists.push(s); }
  
  tabs.innerHTML = `<button class="tmy-tab active" data-pl="WL">Смотреть позже</button>${allPlaylists.map(x => `<button class="tmy-tab" data-pl="${x.id}">${escapeHtml(x.name)}</button>`).join('')}`;
  
  tabs.onclick = (e) => {
    const tab = e.target.closest('.tmy-tab');
    if (tab && tab.dataset.pl !== currentPlaylistId) {
      document.querySelectorAll('.tmy-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentPlaylistId = tab.dataset.pl;
      document.getElementById('tmy-ptitle').textContent = tab.textContent.trim();
      loadVideos(currentPlaylistId);
    }
  };
}

async function loadVideos(plId) {
  const grid = document.getElementById('tmy-grid');
  const load = document.getElementById('tmy-load');
  const count = document.getElementById('tmy-count');
  grid.innerHTML = ''; load.style.display = 'block'; load.textContent = '0';
  
  allVideos = await fetchAllVideos(plId, (n, more) => {
    load.textContent = `${n}${more ? '...' : ''}`;
    count.textContent = n;
  });
  
  load.style.display = 'none';
  count.textContent = allVideos.length;
  if (!allVideos.length) { grid.innerHTML = '<div class="tmy-empty">Пусто или требуется авторизация</div>'; return; }
  await renderGrid();
}

async function renderGrid() {
  const notes = (await sendMessage({ type: 'getAllNotes' }))?.notes || {};
  document.getElementById('tmy-grid').innerHTML = allVideos.map((v, i) => `
    <div class="tmy-card" data-id="${v.id}" data-title="${escapeHtml(v.title)}" style="animation-delay:${Math.min(i, 20) * 15}ms">
      <div class="tmy-thumb"><img src="${v.thumbnail}" loading="lazy">${v.duration ? `<span class="tmy-dur">${v.duration}</span>` : ''}</div>
      <div class="tmy-info"><div class="tmy-title">${escapeHtml(v.title)}</div><div class="tmy-ch">${escapeHtml(v.channel)}</div>${notes[v.id] ? '<span class="tmy-badge">📝</span>' : ''}</div>
    </div>`).join('');
}

// ===== VIDEO PAGE - FULL SCREEN PLAYER + NOTES =====
async function createVideoPage() {
  if (document.getElementById('tmy-vpage')) return;
  
  const videoId = getVideoId();
  if (!videoId) return;
  currentVideoId = videoId;
  
  // Wait for video element
  await waitForVideo();
  
  const title = document.title.replace(' - YouTube', '');
  
  // Create full screen container
  const page = document.createElement('div');
  page.id = 'tmy-vpage';
  page.innerHTML = `
    <div class="tmy-vpage-header">
      <button id="tmy-vback">← Назад</button>
      <span id="tmy-vtitle">${escapeHtml(title)}</span>
    </div>
    <div class="tmy-vpage-content">
      <div class="tmy-vpage-video" id="tmy-vvideo"></div>
      <div class="tmy-vpage-notes">
        <div class="tmy-vnotes-head">
          <span>Конспект</span>
          <div>
            <button id="tmy-vpreview">Превью</button>
            <button id="tmy-vsave">💾 Сохранить</button>
          </div>
        </div>
        <div class="tmy-vnotes-body">
          <textarea id="tmy-vta" placeholder="# Заметки к видео..."></textarea>
          <div id="tmy-vprev"></div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(page);
  
  // Move YouTube video to our container
  const ytPlayer = document.querySelector('#movie_player') || document.querySelector('video');
  const videoContainer = document.getElementById('tmy-vvideo');
  if (ytPlayer) {
    // Clone the player into our container using iframe approach
    videoContainer.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  
  // Load note
  const r = await sendMessage({ type: 'getNote', videoId });
  document.getElementById('tmy-vta').value = r?.content || '';
  
  // Events
  document.getElementById('tmy-vback').onclick = () => {
    saveVideoNote();
    window.location.href = 'https://www.youtube.com/';
  };
  document.getElementById('tmy-vsave').onclick = () => saveVideoNote(true);
  document.getElementById('tmy-vpreview').onclick = toggleVideoPreview;
  
  // Autosave
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => saveVideoNote(false), 5000);
  
  // Save to history
  sendMessage({ type: 'addToHistory', video: { id: videoId, title, thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` } });
}

function waitForVideo() {
  return new Promise(resolve => {
    const check = () => {
      if (document.querySelector('video') || document.querySelector('#movie_player')) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
    setTimeout(resolve, 3000); // Timeout after 3s
  });
}

async function saveVideoNote(showFeedback) {
  if (!currentVideoId) return;
  const ta = document.getElementById('tmy-vta');
  if (!ta) return;
  const content = ta.value;
  const title = document.getElementById('tmy-vtitle')?.textContent || '';
  await sendMessage({ type: 'saveNote', videoId: currentVideoId, content, title });
  if (folderHandle && content.trim()) await saveToFile(currentVideoId, title, content);
  if (showFeedback) {
    const btn = document.getElementById('tmy-vsave');
    btn.textContent = '✓ Сохранено';
    setTimeout(() => btn.textContent = '💾 Сохранить', 1500);
  }
}

function toggleVideoPreview() {
  const ta = document.getElementById('tmy-vta');
  const prev = document.getElementById('tmy-vprev');
  const btn = document.getElementById('tmy-vpreview');
  if (!prev.style.display || prev.style.display === 'none') {
    prev.innerHTML = mdToHtml(ta.value);
    prev.style.display = 'block';
    ta.style.display = 'none';
    btn.textContent = 'Редактор';
  } else {
    prev.style.display = 'none';
    ta.style.display = 'block';
    btn.textContent = 'Превью';
  }
}

const mdToHtml = (md) => !md ? '<em>Пусто</em>' : md
  .replace(/^### (.*)$/gm, '<h3>$1</h3>')
  .replace(/^## (.*)$/gm, '<h2>$1</h2>')
  .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/`(.*?)`/g, '<code>$1</code>')
  .replace(/^- (.*)$/gm, '<li>$1</li>')
  .replace(/\n/g, '<br>');

// ===== NOTES PAGE =====
async function openNotesPage() {
  const page = document.getElementById('tmy-notespage');
  const list = document.getElementById('tmy-nlist');
  page.style.display = 'block';
  document.querySelector('.tmy-container').style.display = 'none';
  
  list.innerHTML = '<div class="tmy-load">Загрузка...</div>';
  
  const settings = await sendMessage({ type: 'getSettings' });
  const fstatus = document.getElementById('tmy-fstatus');
  if (settings?.obsidianFolder) {
    fstatus.innerHTML = `📁 <b>${settings.obsidianFolder}</b> ${folderHandle ? '(подключена)' : '(нужно выбрать снова)'}`;
  } else {
    fstatus.innerHTML = '📁 Папка не выбрана';
  }
  
  const notes = (await sendMessage({ type: 'getAllNotes' }))?.notes || {};
  const hist = (await sendMessage({ type: 'getHistory' }))?.history || [];
  const entries = Object.entries(notes).filter(([, c]) => c && c.trim());
  
  if (!entries.length) {
    list.innerHTML = '<div class="tmy-empty">Конспектов пока нет</div>';
    return;
  }
  
  list.innerHTML = entries.map(([id, c]) => {
    const h = hist.find(x => x.id === id);
    const t = h?.title || id;
    const lines = c.split('\n').length;
    return `
      <div class="tmy-note-row">
        <img src="https://i.ytimg.com/vi/${id}/default.jpg">
        <div class="tmy-note-info">
          <span class="tmy-note-t">${escapeHtml(t)}</span>
          <span class="tmy-note-meta">${lines} строк · ${c.length} симв.</span>
        </div>
        <div class="tmy-note-btns">
          <button data-go="${id}" data-t="${escapeHtml(t)}" title="Смотреть">▶</button>
          <button data-dl="${id}" data-t="${escapeHtml(t)}" title="Скачать">⬇</button>
          <button data-del="${id}" class="tmy-del" title="Удалить">🗑</button>
        </div>
      </div>`;
  }).join('');
  
  list.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.dataset.go) { window.location.href = `https://www.youtube.com/watch?v=${btn.dataset.go}`; }
    if (btn.dataset.dl) { const r = await sendMessage({ type: 'getNote', videoId: btn.dataset.dl }); download(btn.dataset.t, r?.content || ''); }
    if (btn.dataset.del && confirm('Удалить?')) { await sendMessage({ type: 'deleteNote', videoId: btn.dataset.del }); openNotesPage(); }
  };
}

function closeNotesPage() {
  document.getElementById('tmy-notespage').style.display = 'none';
  document.querySelector('.tmy-container').style.display = 'block';
}

const download = (name, content) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
  a.download = `${name.replace(/[^\w\sа-яА-Я]/g, '').slice(0, 50)}.md`;
  a.click();
};

async function exportAll() {
  const notes = (await sendMessage({ type: 'getAllNotes' }))?.notes || {};
  const hist = (await sendMessage({ type: 'getHistory' }))?.history || [];
  let md = '# Конспекты YouTube\n\n';
  Object.entries(notes).forEach(([id, c]) => {
    const t = hist.find(h => h.id === id)?.title || id;
    md += `---\n\n## ${t}\n\nhttps://youtube.com/watch?v=${id}\n\n${c}\n\n`;
  });
  download('youtube-notes', md);
}

// ===== OBSIDIAN =====
async function pickFolder() {
  try {
    folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await sendMessage({ type: 'saveSettings', settings: { obsidianFolder: folderHandle.name } });
    const fp = document.getElementById('tmy-fpath');
    if (fp) fp.textContent = folderHandle.name + ' (подключена)';
    const fs = document.getElementById('tmy-fstatus');
    if (fs) fs.innerHTML = `📁 <b>${folderHandle.name}</b> (подключена)`;
  } catch (e) {}
}

async function saveToFile(id, title, content) {
  if (!folderHandle || !content.trim()) return;
  try {
    const safeName = title.replace(/[<>:"/\\|?*]/g, '').slice(0, 60);
    const filename = `${safeName} [${id}].md`;
    const fh = await folderHandle.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(`---\ntitle: "${title.replace(/"/g, '\\"')}"\nyoutube: https://youtube.com/watch?v=${id}\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n\n${content}`);
    await w.close();
  } catch (e) {}
}

// ===== RESEARCH MODE =====
function injectAddBtn() {
  new MutationObserver(() => {
    document.querySelectorAll('ytd-playlist-header-renderer').forEach(h => {
      if (h.querySelector('.tmy-add')) return;
      const t = h.querySelector('#title');
      if (!t) return;
      const btn = document.createElement('button');
      btn.className = 'tmy-add';
      btn.textContent = '+ TMY';
      btn.onclick = async (e) => {
        e.stopPropagation();
        const pl = new URLSearchParams(location.search).get('list');
        if (pl) {
          await sendMessage({ type: 'addPlaylist', playlist: { id: pl, name: t.textContent?.trim() || 'Playlist' } });
          btn.textContent = '✓';
        }
      };
      t.parentElement?.appendChild(btn);
    });
  }).observe(document.body, { childList: true, subtree: true });
}

// ===== INIT =====
async function init() {
  await checkResearchMode();
  
  if (researchMode) {
    if (isPlaylistPage()) injectAddBtn();
    return;
  }
  
  if (isHomePage() && !homePageCreating) {
    homePageCreating = true;
    await createHomePage();
  }
  
  if (isVideoPage()) {
    await createVideoPage();
  }
}

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    homePageCreating = false;
    
    if (autoSaveInterval) { clearInterval(autoSaveInterval); autoSaveInterval = null; }
    document.getElementById('tmy-app')?.remove();
    document.getElementById('tmy-vpage')?.remove();
    currentVideoId = null;
    
    init();
  }
}).observe(document, { subtree: true, childList: true });

chrome.runtime.onMessage.addListener((m) => { if (m.type === 'researchModeChanged') location.reload(); });

if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);
