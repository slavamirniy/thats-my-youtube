chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['notes', 'history', 'playlists', 'settings'], (data) => {
    chrome.storage.local.set({
      researchMode: false,
      researchModeEndTime: null,
      notes: data.notes || {},
      history: data.history || [],
      playlists: data.playlists || [],
      settings: data.settings || {}
    });
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'researchModeEnd') {
    chrome.storage.local.set({
      researchMode: false,
      researchModeEndTime: null
    });
    notifyTabs('researchModeChanged', { enabled: false });
  }
});

function notifyTabs(type, data = {}) {
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type, ...data }).catch(() => {});
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    // Research Mode
    enableResearchMode: async () => {
      const endTime = Date.now() + 60 * 60 * 1000;
      await chrome.storage.local.set({ researchMode: true, researchModeEndTime: endTime });
      chrome.alarms.create('researchModeEnd', { when: endTime });
      notifyTabs('researchModeChanged', { enabled: true });
      return { success: true, endTime };
    },
    
    disableResearchMode: async () => {
      await chrome.storage.local.set({ researchMode: false, researchModeEndTime: null });
      chrome.alarms.clear('researchModeEnd');
      notifyTabs('researchModeChanged', { enabled: false });
      return { success: true };
    },
    
    getResearchMode: async () => {
      const data = await chrome.storage.local.get(['researchMode', 'researchModeEndTime']);
      if (data.researchMode && data.researchModeEndTime && Date.now() > data.researchModeEndTime) {
        await chrome.storage.local.set({ researchMode: false, researchModeEndTime: null });
        return { researchMode: false, endTime: null };
      }
      return { researchMode: data.researchMode, endTime: data.researchModeEndTime };
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
    }
  };
  
  const handler = handlers[message.type];
  if (handler) {
    handler().then(sendResponse).catch(() => sendResponse(null));
    return true;
  }
});
