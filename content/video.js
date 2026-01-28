// Video page
async function createVideoPage() {
  if (document.getElementById('tmy-vpage')) return;
  
  const videoId = getVideoId();
  if (!videoId) return;
  TMY.currentVideoId = videoId;
  
  await waitForVideo();
  
  const title = document.title.replace(' - YouTube', '');
  
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
            <button id="tmy-vfolder" title="Выбрать папку Obsidian">📁</button>
            <button id="tmy-vpreview">Превью</button>
            <button id="tmy-vsave">💾</button>
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
  
  // Move original YouTube player to our container
  const videoContainer = document.getElementById('tmy-vvideo');
  const ytPlayer = document.querySelector('#movie_player');
  if (ytPlayer) {
    ytPlayer.style.width = '100%';
    ytPlayer.style.height = '100%';
    videoContainer.appendChild(ytPlayer);
  }
  
  const r = await sendMessage({ type: 'getNote', videoId });
  document.getElementById('tmy-vta').value = r?.content || '';
  
  document.getElementById('tmy-vback').onclick = () => {
    saveVideoNote();
    window.location.href = 'https://www.youtube.com/';
  };
  document.getElementById('tmy-vfolder').onclick = async () => {
    await pickFolder();
    updateFolderButton();
  };
  document.getElementById('tmy-vsave').onclick = () => saveVideoNote(true);
  document.getElementById('tmy-vpreview').onclick = toggleVideoPreview;
  
  updateFolderButton();
  
  if (TMY.autoSaveInterval) clearInterval(TMY.autoSaveInterval);
  TMY.autoSaveInterval = setInterval(() => saveVideoNote(false), 5000);
  
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
    setTimeout(resolve, 3000);
  });
}

function updateFolderButton() {
  const btn = document.getElementById('tmy-vfolder');
  if (btn) {
    btn.textContent = TMY.folderHandle ? '📁✓' : '📁';
    btn.title = TMY.folderHandle ? `Папка: ${TMY.folderHandle.name}` : 'Выбрать папку Obsidian';
  }
}

async function saveVideoNote(showFeedback) {
  if (!TMY.currentVideoId) return;
  const ta = document.getElementById('tmy-vta');
  if (!ta) return;
  const content = ta.value;
  const title = document.getElementById('tmy-vtitle')?.textContent || '';
  await sendMessage({ type: 'saveNote', videoId: TMY.currentVideoId, content, title });
  if (TMY.folderHandle && content.trim()) await saveToFile(TMY.currentVideoId, title, content);
  if (showFeedback) {
    const btn = document.getElementById('tmy-vsave');
    btn.textContent = '✓';
    setTimeout(() => btn.textContent = '💾', 1500);
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
