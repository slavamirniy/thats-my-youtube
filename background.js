const RESEARCH_LIMIT_MS = 60 * 60 * 1000; // 1 hour
const RESEARCH_RESET_MS = 12 * 60 * 60 * 1000; // 12 hours
const PROCRASTINATION_WATCH_MS = 3 * 60 * 1000; // 3 minutes watch
const PROCRASTINATION_PAUSE_MS = 3 * 60 * 1000; // 3 minutes pause

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['notes', 'history', 'playlists', 'settings', 'researchUsed', 'researchResetTime'], (data) => {
    let researchUsed = data.researchUsed || 0;
    let researchResetTime = data.researchResetTime || null;
    
    // Check if reset period passed
    if (researchResetTime && Date.now() > researchResetTime) {
      researchUsed = 0;
      researchResetTime = null;
    }
    
    chrome.storage.local.set({
      researchMode: false,
      researchUsed,
      researchResetTime,
      researchStartedAt: null,
      notes: data.notes || {},
      history: data.history || [],
      playlists: data.playlists || [],
      settings: data.settings || {}
    });
  });
});

// Check reset on every startup (service worker wake)
chrome.storage.local.get(['researchUsed', 'researchResetTime', 'researchMode'], (data) => {
  let researchUsed = data.researchUsed || 0;
  let researchResetTime = data.researchResetTime;
  
  if (researchResetTime && Date.now() > researchResetTime) {
    chrome.storage.local.set({
      researchUsed: 0,
      researchResetTime: null,
      researchMode: false,
      researchStartedAt: null
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'researchLimitReached') {
    chrome.storage.local.get(['researchStartedAt', 'researchUsed'], async (data) => {
      if (data.researchStartedAt) {
        const sessionTime = Date.now() - data.researchStartedAt;
        const newUsed = Math.min((data.researchUsed || 0) + sessionTime, RESEARCH_LIMIT_MS);
        await chrome.storage.local.set({
          researchMode: false,
          researchUsed: newUsed,
          researchStartedAt: null
        });
      } else {
        await chrome.storage.local.set({ researchMode: false, researchStartedAt: null });
      }
      notifyTabs('researchModeChanged', { enabled: false });
    });
  }
  if (alarm.name === 'researchReset') {
    chrome.storage.local.set({ researchUsed: 0, researchResetTime: null });
  }
});

function notifyTabs(type, data = {}) {
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type, ...data }).catch(() => {});
    });
  });
}

// Pause research mode when no YouTube tabs are open
async function checkYouTubeTabs() {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' });
  const data = await chrome.storage.local.get(['researchMode', 'researchStartedAt', 'researchUsed', 'researchPaused']);
  
  if (data.researchMode && data.researchStartedAt) {
    if (tabs.length === 0 && !data.researchPaused) {
      // No YouTube tabs - pause timer
      const sessionTime = Date.now() - data.researchStartedAt;
      const newUsed = Math.min((data.researchUsed || 0) + sessionTime, RESEARCH_LIMIT_MS);
      await chrome.storage.local.set({
        researchUsed: newUsed,
        researchStartedAt: null,
        researchPaused: true
      });
      chrome.alarms.clear('researchLimitReached');
    } else if (tabs.length > 0 && data.researchPaused && data.researchMode) {
      // YouTube tab opened and research mode is ON - resume timer
      const remaining = RESEARCH_LIMIT_MS - (data.researchUsed || 0);
      if (remaining > 0) {
        const now = Date.now();
        await chrome.storage.local.set({
          researchStartedAt: now,
          researchPaused: false
        });
        chrome.alarms.create('researchLimitReached', { when: now + remaining });
      }
    }
  }
}

chrome.tabs.onRemoved.addListener(checkYouTubeTabs);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) checkYouTubeTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    // Research Mode
    enableResearchMode: async () => {
      const data = await chrome.storage.local.get(['researchUsed', 'researchResetTime']);
      let used = data.researchUsed || 0;
      let resetTime = data.researchResetTime;
      
      // Check if reset period passed
      if (resetTime && Date.now() > resetTime) {
        used = 0;
        resetTime = null;
      }
      
      // Check if limit reached
      if (used >= RESEARCH_LIMIT_MS) {
        return { success: false, error: 'limit_reached', resetTime };
      }
      
      const remaining = RESEARCH_LIMIT_MS - used;
      const now = Date.now();
      
      // Set reset time if not set
      if (!resetTime) {
        resetTime = now + RESEARCH_RESET_MS;
        chrome.alarms.create('researchReset', { when: resetTime });
      }
      
      await chrome.storage.local.set({
        researchMode: true,
        researchStartedAt: now,
        researchResetTime: resetTime,
        researchPaused: false
      });
      
      // Alarm when limit will be reached
      chrome.alarms.create('researchLimitReached', { when: now + remaining });
      notifyTabs('researchModeChanged', { enabled: true });
      return { success: true, remaining, used, resetTime };
    },
    
    disableResearchMode: async () => {
      const data = await chrome.storage.local.get(['researchStartedAt', 'researchUsed']);
      let newUsed = data.researchUsed || 0;
      
      if (data.researchStartedAt) {
        const sessionTime = Date.now() - data.researchStartedAt;
        newUsed = Math.min(newUsed + sessionTime, RESEARCH_LIMIT_MS);
      }
      
      await chrome.storage.local.set({
        researchMode: false,
        researchUsed: newUsed,
        researchStartedAt: null
      });
      chrome.alarms.clear('researchLimitReached');
      notifyTabs('researchModeChanged', { enabled: false });
      return { success: true, used: newUsed };
    },
    
    getResearchMode: async () => {
      const data = await chrome.storage.local.get(['researchMode', 'researchUsed', 'researchStartedAt', 'researchResetTime']);
      let used = data.researchUsed || 0;
      let resetTime = data.researchResetTime;
      
      // Check if reset period passed
      if (resetTime && Date.now() > resetTime) {
        used = 0;
        resetTime = null;
        await chrome.storage.local.set({ researchUsed: 0, researchResetTime: null });
      }
      
      // Calculate current used time if active
      if (data.researchMode && data.researchStartedAt) {
        const sessionTime = Date.now() - data.researchStartedAt;
        const totalUsed = used + sessionTime;
        
        // Auto-disable if over limit
        if (totalUsed >= RESEARCH_LIMIT_MS) {
          await chrome.storage.local.set({
            researchMode: false,
            researchUsed: RESEARCH_LIMIT_MS,
            researchStartedAt: null
          });
          return { researchMode: false, used: RESEARCH_LIMIT_MS, remaining: 0, resetTime };
        }
        
        return {
          researchMode: true,
          used: totalUsed,
          remaining: RESEARCH_LIMIT_MS - totalUsed,
          resetTime,
          startedAt: data.researchStartedAt
        };
      }
      
      return {
        researchMode: data.researchMode || false,
        used,
        remaining: RESEARCH_LIMIT_MS - used,
        resetTime
      };
    },
    
    // Notes
    saveNote: async () => {
      const data = await chrome.storage.local.get(['notes']);
      const notes = data.notes || {};
      notes[message.videoId] = message.content;
      await chrome.storage.local.set({ notes });
      return { success: true };
    },
    
    getNote: async () => {
      const data = await chrome.storage.local.get(['notes']);
      return { content: (data.notes || {})[message.videoId] || '' };
    },
    
    getAllNotes: async () => {
      const data = await chrome.storage.local.get(['notes']);
      return { notes: data.notes || {} };
    },
    
    deleteNote: async () => {
      const data = await chrome.storage.local.get(['notes']);
      const notes = data.notes || {};
      delete notes[message.videoId];
      await chrome.storage.local.set({ notes });
      return { success: true };
    },
    
    // History
    addToHistory: async () => {
      const data = await chrome.storage.local.get(['history']);
      let history = data.history || [];
      history = history.filter(v => v.id !== message.video.id);
      history.unshift({ ...message.video, timestamp: Date.now() });
      history = history.slice(0, 50);
      await chrome.storage.local.set({ history });
      return { success: true };
    },
    
    getHistory: async () => {
      const data = await chrome.storage.local.get(['history']);
      return { history: data.history || [] };
    },
    
    clearHistory: async () => {
      await chrome.storage.local.set({ history: [] });
      return { success: true };
    },
    
    // Playlists
    addPlaylist: async () => {
      const data = await chrome.storage.local.get(['playlists']);
      const playlists = data.playlists || [];
      if (!playlists.find(p => p.id === message.playlist.id)) {
        playlists.push(message.playlist);
        await chrome.storage.local.set({ playlists });
      }
      return { success: true };
    },
    
    removePlaylist: async () => {
      const data = await chrome.storage.local.get(['playlists']);
      const playlists = (data.playlists || []).filter(p => p.id !== message.playlistId);
      await chrome.storage.local.set({ playlists });
      return { success: true };
    },
    
    getPlaylists: async () => {
      const data = await chrome.storage.local.get(['playlists']);
      return { playlists: data.playlists || [] };
    },
    
    // Settings
    saveSettings: async () => {
      const data = await chrome.storage.local.get(['settings']);
      const settings = { ...(data.settings || {}), ...message.settings };
      await chrome.storage.local.set({ settings });
      return { success: true };
    },
    
    getSettings: async () => {
      const data = await chrome.storage.local.get(['settings']);
      return data.settings || {};
    },
    
    // Procrastination timer
    getProcrastinationState: async () => {
      const data = await chrome.storage.local.get(['procrastination']);
      const state = data.procrastination || {};
      const site = message.site;
      const siteState = state[site] || { phase: 'watch', phaseStartedAt: Date.now() };
      
      const now = Date.now();
      const elapsed = now - siteState.phaseStartedAt;
      
      if (siteState.phase === 'watch' && elapsed >= PROCRASTINATION_WATCH_MS) {
        // Switch to pause
        siteState.phase = 'pause';
        siteState.phaseStartedAt = now;
        state[site] = siteState;
        await chrome.storage.local.set({ procrastination: state });
        return { phase: 'pause', remaining: PROCRASTINATION_PAUSE_MS };
      }
      
      if (siteState.phase === 'pause' && elapsed >= PROCRASTINATION_PAUSE_MS) {
        // Switch to watch
        siteState.phase = 'watch';
        siteState.phaseStartedAt = now;
        state[site] = siteState;
        await chrome.storage.local.set({ procrastination: state });
        return { phase: 'watch', remaining: PROCRASTINATION_WATCH_MS };
      }
      
      const limit = siteState.phase === 'watch' ? PROCRASTINATION_WATCH_MS : PROCRASTINATION_PAUSE_MS;
      return { phase: siteState.phase, remaining: limit - elapsed };
    },
    
    initProcrastination: async () => {
      const data = await chrome.storage.local.get(['procrastination']);
      const state = data.procrastination || {};
      const site = message.site;
      
      if (!state[site]) {
        state[site] = { phase: 'watch', phaseStartedAt: Date.now() };
        await chrome.storage.local.set({ procrastination: state });
      }
      
      return await handlers.getProcrastinationState();
    },
    
    // Procrastination notes
    getProcrastinationNotes: async () => {
      const data = await chrome.storage.local.get(['procrastinationNotes']);
      return { notes: data.procrastinationNotes || [] };
    },
    
    saveProcrastinationNote: async () => {
      const data = await chrome.storage.local.get(['procrastinationNotes']);
      const notes = data.procrastinationNotes || [];
      const existing = notes.find(n => n.id === message.noteId);
      if (existing) {
        existing.content = message.content;
        existing.updatedAt = Date.now();
      } else {
        notes.unshift({
          id: message.noteId || `proc_${Date.now()}`,
          title: message.title || 'Без названия',
          content: message.content,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      }
      await chrome.storage.local.set({ procrastinationNotes: notes });
      return { success: true, notes };
    },
    
    createProcrastinationNote: async () => {
      const data = await chrome.storage.local.get(['procrastinationNotes']);
      const notes = data.procrastinationNotes || [];
      const newNote = {
        id: `proc_${Date.now()}`,
        title: message.title || 'Новая заметка',
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      notes.unshift(newNote);
      await chrome.storage.local.set({ procrastinationNotes: notes });
      return { success: true, note: newNote, notes };
    }
  };
  
  const handler = handlers[message.type];
  if (handler) {
    handler().then(sendResponse).catch(() => sendResponse(null));
    return true;
  }
});
