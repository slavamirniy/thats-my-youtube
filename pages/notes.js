let allNotes = {};
let history = [];

async function init() {
  const notesData = await chrome.storage.local.get(['notes', 'history']);
  allNotes = notesData.notes || {};
  history = notesData.history || [];
  
  renderStats();
  renderNotes();
  setupEvents();
}

function renderStats() {
  const entries = Object.entries(allNotes);
  const totalChars = entries.reduce((sum, [, content]) => sum + content.length, 0);
  
  document.getElementById('totalNotes').textContent = entries.length;
  document.getElementById('totalChars').textContent = totalChars.toLocaleString();
}

function renderNotes() {
  const list = document.getElementById('notesList');
  const entries = Object.entries(allNotes);
  
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty">У вас пока нет конспектов</div>';
    return;
  }
  
  list.innerHTML = entries.map(([videoId, content]) => {
    const historyItem = history.find(h => h.id === videoId);
    const title = historyItem?.title || `Видео ${videoId}`;
    const thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    const preview = content.slice(0, 150).replace(/[#*`\n]/g, ' ').trim();
    const charCount = content.length;
    
    return `
      <div class="note-card" data-video-id="${videoId}">
        <div class="note-thumb">
          <img src="${thumbnail}" alt="">
        </div>
        <div class="note-content">
          <div class="note-title">${escapeHtml(title)}</div>
          <div class="note-preview">${escapeHtml(preview)}...</div>
          <div class="note-meta">${charCount} символов</div>
        </div>
        <div class="note-actions">
          <button class="note-btn" data-action="view" data-id="${videoId}">Читать</button>
          <button class="note-btn" data-action="download" data-id="${videoId}">Скачать</button>
          <button class="note-btn" data-action="watch" data-id="${videoId}">Смотреть</button>
          <button class="note-btn delete" data-action="delete" data-id="${videoId}">Удалить</button>
        </div>
      </div>
    `;
  }).join('');
}

function setupEvents() {
  document.getElementById('notesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const videoId = btn.dataset.id;
    
    switch (action) {
      case 'view':
        showModal(videoId);
        break;
      case 'download':
        downloadNote(videoId);
        break;
      case 'watch':
        window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
        break;
      case 'delete':
        if (confirm('Удалить конспект?')) {
          delete allNotes[videoId];
          await chrome.storage.local.set({ notes: allNotes });
          renderStats();
          renderNotes();
        }
        break;
    }
  });
  
  document.getElementById('exportAll').addEventListener('click', exportAll);
  
  document.getElementById('modalClose').addEventListener('click', hideModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') hideModal();
  });
}

function showModal(videoId) {
  const content = allNotes[videoId];
  const historyItem = history.find(h => h.id === videoId);
  const title = historyItem?.title || `Видео ${videoId}`;
  
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = markdownToHtml(content);
  document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
}

function downloadNote(videoId) {
  const content = allNotes[videoId];
  const historyItem = history.find(h => h.id === videoId);
  const title = historyItem?.title || videoId;
  const filename = `${title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.md`;
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAll() {
  const entries = Object.entries(allNotes);
  if (entries.length === 0) {
    alert('Нет конспектов для экспорта');
    return;
  }
  
  let content = '# Мои конспекты — That\'s My YouTube\n\n';
  
  entries.forEach(([videoId, noteContent]) => {
    const historyItem = history.find(h => h.id === videoId);
    const title = historyItem?.title || videoId;
    content += `---\n\n## ${title}\n\nhttps://youtube.com/watch?v=${videoId}\n\n${noteContent}\n\n`;
  });
  
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thats-my-youtube-notes-${new Date().toISOString().slice(0,10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function markdownToHtml(md) {
  if (!md) return '<p style="color: var(--text-muted)">Пусто</p>';
  
  return md
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^\- (.*$)/gm, '<li>$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

init();
