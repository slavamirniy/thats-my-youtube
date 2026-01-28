// Utils
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

const escapeHtml = (s) => {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
};

async function checkResearchMode() {
  const r = await sendMessage({ type: 'getResearchMode' });
  TMY.researchMode = r?.researchMode || false;
  return TMY.researchMode;
}

const isHomePage = () => ['/', '/feed/subscriptions'].includes(location.pathname);
const isVideoPage = () => location.pathname === '/watch';
const isPlaylistPage = () => location.pathname === '/playlist';
const getVideoId = () => new URLSearchParams(location.search).get('v');

const mdToHtml = (md) => !md ? '<em>Пусто</em>' : md
  .replace(/^### (.*)$/gm, '<h3>$1</h3>')
  .replace(/^## (.*)$/gm, '<h2>$1</h2>')
  .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.*?)\*/g, '<em>$1</em>')
  .replace(/`(.*?)`/g, '<code>$1</code>')
  .replace(/^- (.*)$/gm, '<li>$1</li>')
  .replace(/\n/g, '<br>');

const download = (name, content) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
  a.download = `${name.replace(/[^\w\sа-яА-Я]/g, '').slice(0, 50)}.md`;
  a.click();
};
