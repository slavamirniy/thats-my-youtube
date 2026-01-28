# That's My YouTube

Chrome extension that replaces YouTube's homepage with a curated "Watch Later" playlist view and adds markdown notes to videos.

## Features

- **Custom Homepage** - Shows your "Watch Later" playlist instead of YouTube's algorithm-driven feed
- **All Videos Loaded** - Loads ALL videos from playlists (even 600+), not just first 100
- **Playlist Tabs** - Auto-fetches your playlists from YouTube account
- **Markdown Notes** - Write notes for each video with live preview
- **Obsidian Sync** - Save notes as .md files to your Obsidian vault
- **Research Mode** - 1-hour timer to temporarily access standard YouTube
- **Watch History** - "Continue watching" section with recent videos
- **Dark Theme** - Minimalist dark design with IBM Plex Mono & Crimson Pro fonts

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Select the extension folder (`thats my youtube`)
6. Go to [youtube.com](https://youtube.com) - you should see the custom homepage

## Usage

### Homepage
- Click on any video to watch it
- Use tabs to switch between playlists
- Use arrow buttons (◀ ▶) to scroll through playlist tabs
- Click "Конспекты" to view all your notes
- Click ⚙ for settings

### Video Page
- Video player on the left, notes panel on the right
- Notes auto-save every 5 seconds
- Click "Превью" to preview markdown
- Click 📁 to connect Obsidian folder for file sync
- Click "← Назад" to return home

### Research Mode
- Click extension icon in toolbar
- Toggle "Research Mode" for 1 hour of normal YouTube
- Timer shows remaining time
- Add playlists to tabs with "+ TMY" button

### Obsidian Integration
- Click 📁 button to select your Obsidian vault folder
- Notes auto-save as `.md` files with YAML frontmatter
- **Note:** Folder must be re-selected after browser restart (browser security limitation)

## File Structure

```
thats my youtube/
├── manifest.json
├── background.js
├── content/
│   ├── state.js
│   ├── utils.js
│   ├── api.js
│   ├── obsidian.js
│   ├── home.js
│   ├── notes.js
│   ├── video.js
│   ├── research.js
│   ├── main.js
│   └── content.css
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── icons/
    └── icon16/48/128.png
```

## Requirements

- Google Chrome (or Chromium-based browser)
- Logged into YouTube account (for playlist access)

## License

MIT
