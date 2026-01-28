// YouTube API
async function fetchUserPlaylists() {
  try {
    const r = await fetch('https://www.youtube.com/feed/playlists', { credentials: 'include' });
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*({.*?});/s);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const playlists = [];
    const items = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.richGridRenderer?.contents || [];
    for (const item of items) {
      const lockup = item?.richItemRenderer?.content?.lockupViewModel || item?.richItemRenderer?.content?.playlistRenderer;
      if (!lockup) continue;
      const contentId = lockup.contentId;
      const metadata = lockup.metadata?.lockupMetadataViewModel;
      const title = metadata?.title?.content;
      if (contentId && title && !contentId.startsWith('WL') && !contentId.startsWith('LL')) {
        playlists.push({ id: contentId, name: title });
      }
      if (lockup.playlistId && lockup.title?.simpleText) {
        playlists.push({ id: lockup.playlistId, name: lockup.title.simpleText });
      }
    }
    return playlists;
  } catch (e) { return []; }
}

async function fetchAllVideos(playlistId, onProgress) {
  let videos = [], cont = null, page = 0;
  const first = await fetchPage(playlistId, null);
  videos = first.videos;
  cont = first.cont;
  onProgress?.(videos.length, !!cont);
  
  while (cont && page < 100) {
    page++;
    await new Promise(r => setTimeout(r, 200));
    const next = await fetchPage(playlistId, cont);
    if (!next.videos.length) break;
    videos = [...videos, ...next.videos];
    cont = next.cont;
    onProgress?.(videos.length, !!cont);
  }
  return videos;
}

async function fetchPage(playlistId, cont) {
  try {
    if (cont) {
      const r = await fetch('https://www.youtube.com/youtubei/v1/browse', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB', clientVersion: '2.20241111.00.00', hl: 'ru', gl: 'RU' } },
          continuation: cont
        })
      });
      return parseCont(await r.json());
    }
    const r = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, { credentials: 'include' });
    const html = await r.text();
    const m = html.match(/ytInitialData\s*=\s*({.*?});/s);
    return m ? parseInit(JSON.parse(m[1])) : { videos: [], cont: null };
  } catch (e) { return { videos: [], cont: null }; }
}

function parseInit(data) {
  const videos = [];
  let cont = null;
  const items = data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents || [];
  for (const i of items) {
    if (i.continuationItemRenderer) { cont = i.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; continue; }
    const v = i.playlistVideoRenderer;
    if (v?.videoId) videos.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, channel: v.shortBylineText?.runs?.[0]?.text || '', duration: v.lengthText?.simpleText || '' });
  }
  return { videos, cont };
}

function parseCont(data) {
  const videos = [];
  let cont = null;
  const items = data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems || [];
  for (const i of items) {
    if (i.continuationItemRenderer) { cont = i.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token; continue; }
    const v = i.playlistVideoRenderer;
    if (v?.videoId) videos.push({ id: v.videoId, title: v.title?.runs?.[0]?.text || '', thumbnail: `https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`, channel: v.shortBylineText?.runs?.[0]?.text || '', duration: v.lengthText?.simpleText || '' });
  }
  return { videos, cont };
}
