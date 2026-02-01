const toggleBtn = document.getElementById('toggle-research');
const modeStatus = document.getElementById('mode-status');
const timerDiv = document.getElementById('timer');
const timeLeftSpan = document.getElementById('time-left');
const usedBar = document.getElementById('used-bar');
const usedText = document.getElementById('used-text');
const resetInfo = document.getElementById('reset-info');

const LIMIT_MS = 60 * 60 * 1000;
let timerInterval = null;

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTimeLeft(ms) {
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / 60000);
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

function updateUI(data) {
  const { researchMode, used, remaining, resetTime, startedAt } = data;
  const usedPercent = Math.min((used / LIMIT_MS) * 100, 100);
  
  usedBar.style.width = `${usedPercent}%`;
  usedText.textContent = `${formatTime(used)} / ${formatTime(LIMIT_MS)}`;
  
  if (resetTime && used > 0) {
    const resetIn = resetTime - Date.now();
    if (resetIn > 0) {
      resetInfo.textContent = `Сброс через ${formatTimeLeft(resetIn)}`;
      resetInfo.classList.remove('hidden');
    } else {
      resetInfo.classList.add('hidden');
    }
  } else {
    resetInfo.classList.add('hidden');
  }
  
  if (remaining <= 0) {
    modeStatus.textContent = 'Лимит исчерпан';
    modeStatus.className = 'mode-status limit';
    toggleBtn.textContent = '⏳ Лимит исчерпан';
    toggleBtn.className = 'btn btn-disabled';
    toggleBtn.disabled = true;
    timerDiv.classList.add('hidden');
    stopTimer();
    return;
  }
  
  toggleBtn.disabled = false;
  
  if (researchMode) {
    modeStatus.textContent = 'Включён';
    modeStatus.className = 'mode-status on';
    toggleBtn.textContent = '⏹ Выключить';
    toggleBtn.className = 'btn btn-secondary';
    timerDiv.classList.remove('hidden');
    startTimer(startedAt, used, remaining);
  } else {
    modeStatus.textContent = 'Выключен';
    modeStatus.className = 'mode-status off';
    toggleBtn.textContent = `🔬 Включить (${formatTime(remaining)})`;
    toggleBtn.className = 'btn btn-primary';
    timerDiv.classList.add('hidden');
    stopTimer();
  }
}

function startTimer(startedAt, baseUsed, initialRemaining) {
  stopTimer();
  
  function update() {
    const sessionTime = Date.now() - startedAt;
    const totalUsed = baseUsed + sessionTime;
    const remaining = LIMIT_MS - totalUsed;
    
    if (remaining <= 0) {
      loadStatus();
      return;
    }
    
    timeLeftSpan.textContent = formatTime(remaining);
    usedBar.style.width = `${(totalUsed / LIMIT_MS) * 100}%`;
    usedText.textContent = `${formatTime(totalUsed)} / ${formatTime(LIMIT_MS)}`;
  }
  
  update();
  timerInterval = setInterval(update, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function loadStatus() {
  chrome.runtime.sendMessage({ type: 'getResearchMode' }, (response) => {
    if (response) updateUI(response);
  });
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'getResearchMode' }, (response) => {
    if (response?.researchMode) {
      chrome.runtime.sendMessage({ type: 'disableResearchMode' }, () => {
        loadStatus();
      });
    } else {
      chrome.runtime.sendMessage({ type: 'enableResearchMode' }, (res) => {
        if (res?.success) {
          loadStatus();
        } else if (res?.error === 'limit_reached') {
          loadStatus();
        }
      });
    }
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'researchModeChanged') {
    loadStatus();
  }
});

loadStatus();
