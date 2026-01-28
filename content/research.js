// Research mode
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
