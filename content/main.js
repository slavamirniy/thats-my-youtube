// Main initialization
async function init() {
  await checkResearchMode();
  
  if (TMY.researchMode) {
    if (isPlaylistPage()) injectAddBtn();
    return;
  }
  
  if (isHomePage() && !TMY.homePageCreating) {
    TMY.homePageCreating = true;
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
    TMY.homePageCreating = false;
    
    if (TMY.autoSaveInterval) { clearInterval(TMY.autoSaveInterval); TMY.autoSaveInterval = null; }
    document.getElementById('tmy-app')?.remove();
    document.getElementById('tmy-vpage')?.remove();
    TMY.currentVideoId = null;
    
    init();
  }
}).observe(document, { subtree: true, childList: true });

chrome.runtime.onMessage.addListener((m) => { if (m.type === 'researchModeChanged') location.reload(); });

if (document.body) init();
else document.addEventListener('DOMContentLoaded', init);
