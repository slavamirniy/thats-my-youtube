// Procrastination blocker for Instagram
const SITE = 'instagram';
let currentPhase = 'watch';
let timerInterval = null;
let overlay = null;
let timerBadge = null;
let currentNoteId = null;
let mutedElements = [];
let autoSaveInterval = null;

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

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function createTimerBadge() {
  if (timerBadge) return;
  timerBadge = document.createElement('div');
  timerBadge.id = 'tmy-proc-timer';
  timerBadge.innerHTML = '<span id="tmy-proc-time">3:00</span>';
  document.body.appendChild(timerBadge);
}

function createOverlay() {
  if (overlay) return;
  overlay = document.createElement('div');
  overlay.id = 'tmy-proc-overlay';
  overlay.innerHTML = `
    <div class="tmy-proc-content">
      <div class="tmy-proc-header">
        <div class="tmy-proc-countdown">
          <span class="tmy-proc-label">Пауза</span>
          <span id="tmy-proc-pause-time" class="tmy-proc-big-time">3:00</span>
        </div>
      </div>
      <div class="tmy-proc-notes">
        <div class="tmy-proc-notes-header">
          <span>Заметки (прокрастинация)</span>
          <button id="tmy-proc-new-note">+ Новая</button>
        </div>
        <div id="tmy-proc-notes-list" class="tmy-proc-notes-list"></div>
        <div class="tmy-proc-editor">
          <textarea id="tmy-proc-textarea" placeholder="Пиши заметки пока ждёшь..."></textarea>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('tmy-proc-new-note').onclick = createNewNote;
  document.getElementById('tmy-proc-textarea').oninput = saveCurrentNote;
  
  loadNotes();
}

async function loadNotes() {
  const data = await sendMessage({ type: 'getProcrastinationNotes' });
  const notes = data?.notes || [];
  const list = document.getElementById('tmy-proc-notes-list');
  if (!list) return;
  
  list.innerHTML = notes.map(n => `
    <div class="tmy-proc-note-item ${n.id === currentNoteId ? 'active' : ''}" data-id="${n.id}">
      <span class="tmy-proc-note-title">${escapeHtml(n.title)}</span>
      <span class="tmy-proc-note-date">${new Date(n.updatedAt).toLocaleDateString()}</span>
    </div>
  `).join('') || '<div class="tmy-proc-empty">Нет заметок</div>';
  
  list.onclick = (e) => {
    const item = e.target.closest('[data-id]');
    if (item) selectNote(item.dataset.id, notes);
  };
  
  // Auto-select first note if none selected
  if (!currentNoteId && notes.length > 0) {
    selectNote(notes[0].id, notes);
  } else if (currentNoteId) {
    const note = notes.find(n => n.id === currentNoteId);
    if (note) {
      document.getElementById('tmy-proc-textarea').value = note.content;
    }
  }
}

function selectNote(id, notes) {
  currentNoteId = id;
  const note = notes.find(n => n.id === id);
  if (note) {
    document.getElementById('tmy-proc-textarea').value = note.content;
  }
  document.querySelectorAll('.tmy-proc-note-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
}

async function createNewNote() {
  const title = prompt('Название заметки:') || 'Новая заметка';
  const data = await sendMessage({ type: 'createProcrastinationNote', title });
  if (data?.note) {
    currentNoteId = data.note.id;
    document.getElementById('tmy-proc-textarea').value = '';
    loadNotes();
  }
}

async function saveCurrentNote() {
  if (!currentNoteId) {
    // Create new note if none selected
    const data = await sendMessage({ type: 'createProcrastinationNote', title: 'Быстрая заметка' });
    if (data?.note) {
      currentNoteId = data.note.id;
    }
  }
  
  const content = document.getElementById('tmy-proc-textarea')?.value || '';
  await sendMessage({ type: 'saveProcrastinationNote', noteId: currentNoteId, content });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function muteAllMedia() {
  // Mute all video and audio elements
  document.querySelectorAll('video, audio').forEach(el => {
    if (!el.muted) {
      el.muted = true;
      mutedElements.push(el);
    }
  });
}

function unmuteAllMedia() {
  mutedElements.forEach(el => {
    el.muted = false;
  });
  mutedElements = [];
}

function showOverlay() {
  if (!overlay) createOverlay();
  overlay.classList.add('visible');
  document.body.classList.add('tmy-proc-blocked');
  muteAllMedia();
  loadNotes();
  
  // Start autosave
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(saveCurrentNote, 5000);
}

function hideOverlay() {
  if (overlay) overlay.classList.remove('visible');
  document.body.classList.remove('tmy-proc-blocked');
  unmuteAllMedia();
  
  // Save and stop autosave
  saveCurrentNote();
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

function updateTimerBadge(remaining) {
  const timeEl = document.getElementById('tmy-proc-time');
  if (timeEl) timeEl.textContent = formatTime(remaining);
}

function updatePauseTimer(remaining) {
  const timeEl = document.getElementById('tmy-proc-pause-time');
  if (timeEl) timeEl.textContent = formatTime(remaining);
}

async function tick() {
  const state = await sendMessage({ type: 'getProcrastinationState', site: SITE });
  if (!state) return;
  
  if (state.phase !== currentPhase) {
    currentPhase = state.phase;
    if (currentPhase === 'pause') {
      showOverlay();
      timerBadge?.classList.add('hidden');
    } else {
      hideOverlay();
      timerBadge?.classList.remove('hidden');
    }
  }
  
  if (currentPhase === 'watch') {
    updateTimerBadge(state.remaining);
  } else {
    updatePauseTimer(state.remaining);
  }
}

async function init() {
  // Initialize state
  const state = await sendMessage({ type: 'initProcrastination', site: SITE });
  if (!state) return;
  
  currentPhase = state.phase;
  
  createTimerBadge();
  createOverlay();
  
  if (currentPhase === 'pause') {
    showOverlay();
    timerBadge?.classList.add('hidden');
  }
  
  // Update every second
  timerInterval = setInterval(tick, 1000);
  tick();
  
  // Watch for new media elements
  const observer = new MutationObserver(() => {
    if (currentPhase === 'pause') {
      muteAllMedia();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);
