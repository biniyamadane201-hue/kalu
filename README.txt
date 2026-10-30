QALU — UPGRADED AMHARIC BIBLE WEBSITE

Files:
- index.html: application interface
- style.css: original application styles
- premium.css: premium forest-green, gold, and ivory design layer
- app.js: Bible reader behavior, settings, search, favorites, highlights, daily verse, reading position
- amharic_bible.json: original Bible data (preserved)
- manifest.json, service-worker.js, assets/qalu-icon.svg: install/offline support foundation

HOW TO RUN IN VS CODE
1. Extract the folder.
2. Open the folder in VS Code.
3. Install/use the Live Server extension if you do not already have it.
4. Right-click index.html and choose "Open with Live Server".
5. Wait for the Bible data to load. The first load needs internet access if the browser must download Google Fonts.

NOTES
- The Bible JSON file is preserved as supplied.
- Favorites, highlights, and settings are stored in this browser's localStorage.
- The last-read book/chapter is remembered in this browser.
- The daily verse is selected from the supplied Bible JSON and stays stable for the date in the user's browser timezone.
- PWA/offline support requires serving the site over localhost or HTTPS. Verify installation and offline behavior in the target browser before publishing.
- The service worker caches the Bible JSON (about 5.7 MB in the supplied project), so the first successful load may take a little time.
