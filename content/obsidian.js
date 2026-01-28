// Obsidian file sync
async function pickFolder() {
  try {
    TMY.folderHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await sendMessage({ type: 'saveSettings', settings: { obsidianFolder: TMY.folderHandle.name } });
    const fp = document.getElementById('tmy-fpath');
    if (fp) fp.textContent = TMY.folderHandle.name + ' (подключена)';
    const fs = document.getElementById('tmy-fstatus');
    if (fs) fs.innerHTML = `📁 <b>${TMY.folderHandle.name}</b> (подключена)`;
  } catch (e) {}
}

async function saveToFile(id, title, content) {
  if (!TMY.folderHandle || !content.trim()) return;
  try {
    const safeName = title.replace(/[<>:"/\\|?*]/g, '').slice(0, 60);
    const filename = `${safeName} [${id}].md`;
    const fh = await TMY.folderHandle.getFileHandle(filename, { create: true });
    const w = await fh.createWritable();
    await w.write(`---\ntitle: "${title.replace(/"/g, '\\"')}"\nyoutube: https://youtube.com/watch?v=${id}\ndate: ${new Date().toISOString().slice(0, 10)}\n---\n\n${content}`);
    await w.close();
  } catch (e) {}
}
