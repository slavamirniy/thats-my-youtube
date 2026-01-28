const toggleBtn = document.getElementById('toggle-research');
const modeStatus = document.getElementById('mode-status');
const timerDiv = document.getElementById('timer');
const timeLeftSpan = document.getElementById('time-left');

let timerInterval = null;

function updateUI(researchMode, endTime) {
  if (researchMode && endTime) {
    modeStatus.textContent = 'Включён';
    modeStatus.className = 'mode-status on';
    toggleBtn.textContent = '⏹ Выключить';
    toggleBtn.className = 'btn btn-secondary';
    timerDiv.classList.remove('hidden');
    startTimer(endTime);
  } else {
    modeStatus.textContent = 'Выключен';
    modeStatus.className = 'mode-status off';
    toggleBtn.textContent = '🔬 Включить на 1 час';
    toggleBtn.className = 'btn btn-primary';
    timerDiv.classList.add('hidden');
    stopTimer();
  }
}

function startTimer(endTime) {
  stopTimer();
  
  function update() {
    const now = Date.now();
    const remaining = endTime - now;
    
    if (remaining <= 0) {
      updateUI(false, null);
      return;
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    timeLeftSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
    updateUI(response?.researchMode, response?.endTime);
  });
}

toggleBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'getResearchMode' }, (response) => {
    if (response?.researchMode) {
      chrome.runtime.sendMessage({ type: 'disableResearchMode' }, () => {
        updateUI(false, null);
        notifyContentScript(false);
      });
    } else {
      chrome.runtime.sendMessage({ type: 'enableResearchMode' }, (res) => {
        updateUI(true, res.endTime);
        notifyContentScript(true);
      });
    }
  });
});

function notifyContentScript(enabled) {
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'researchModeChanged', enabled });
    });
  });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'researchModeEnded') {
    updateUI(false, null);
  }
});

loadStatus();
