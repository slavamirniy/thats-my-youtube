// Notes page
async function openNotesPage() {
  const page = document.getElementById('tmy-notespage');
  const list = document.getElementById('tmy-nlist');
  page.style.display = 'block';
  document.querySelector('.tmy-container').style.display = 'none';
  
  list.innerHTML = '<div class="tmy-load">Загрузка...</div>';
  
  const settings = await sendMessage({ type: 'getSettings' });
  const fstatus = document.getElementById('tmy-fstatus');
  if (settings?.obsidianFolder) {
    fstatus.innerHTML = `📁 <b>${settings.obsidianFolder}</b> ${TMY.folderHandle ? '(подключена)' : '(нужно выбрать снова)'}`;
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
