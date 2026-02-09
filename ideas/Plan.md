
### **Phase 3: Port & Refactor YouTube API Wrapper**
1. youtube-api-v3.js → `src/youtubeApi.js`
   - Remove jQuery dependency
   - Replace `$.ajax` với `node-fetch`
   - Export CommonJS module
   - Add error handling for Node.js environment

### **Phase 4: Create Core Modules**
1. **src/config.js** - Load playlists.json + env vars
2. **src/playlistTracker.js** - Main logic:
   - `fetchPlaylistMetadata()` - Get all video IDs từ playlist
   - `fetchVideoMetadata()` - Batch fetch từng video
   - `compareSnapshots()` - Diff logic (new / removed / private / deleted)
   - `buildSnapshot()` - Create new snapshot object
3. **src/snapshotManager.js**
   - `saveSnapshot(playlistId, snapshot)`
   - `loadSnapshot(playlistId)`
   - `loadSnapshotHistory(playlistId)`
4. **src/thumbnailDownloader.js**
   - Download + save PNG/JPG
   - Cache check (skip if exists)
5. **src/logger.js**
   - Console + file logging
   - Timestamps + log levels

### **Phase 5: Create Configuration Files**
1. **config/playlists.json** - User config:
   ```json
   {
     "playlists": [
       { "id": "PLxxx", "name": "My Playlist", "checkFreq": "daily" }
     ]
   }
   ```
2. **.env.example**
   ```
   YOUTUBE_API_KEY=AIzaSy...
   GITHUB_TOKEN=ghp_...  (optional - for auto-commits)
   ```

### **Phase 6: Create GitHub Actions Workflow**
1. **.github/workflows/sync-playlists.yml**
   - Cron trigger (daily suggested)
   - Run `node src/index.js`
   - Auto-commit + push changes nếu có diff
   - Send logs / report

### **Phase 7: Create package.json & Dependencies**
1. **package.json**
   - `node-fetch` (HTTP client)
   - `dotenv` (env vars)
   - `date-fns` (date utilities)
   - Dev: jest (testing)

### **Phase 8: Update Documentation**
1. **README.md** - New spec:
   - Project goal
   - Quick start
   - Config guide
   - Data model
   - Development
2. Giữ LICENSE

### **Phase 9: Create Test Setup** (Optional Phase 1)
1. Tests unit cho each module
2. Tests integration với mock API

---

## **Verification**

- [ ] `npm install` chạy không lỗi
- [ ] `node src/index.js` chạy thành công (với API key hợp lệ)
- [ ] Generate snapshot file ở `data/snapshots/`
- [ ] Lần 2 chạy: diff so sánh chính xác (no false positives)
- [ ] GitHub Actions workflow trigger thành công
- [ ] Thumbnails download đúng folder

---

## **Decisions (Clarify for User)**

✅ **Giữ lại:**
- youtube-api-v3.js (port thành Node.js)
- shared.js (URL parsing helpers - optional, có thể port)
- .git history
- LICENSE

✅ **Xóa hoàn toàn:**
- Jekyll setup (_config.yml, Gemfile, _layouts, _includes)
- HTML UI (`*.html` trừ future `viewer.html` nếu cần)
- translators.js (không dùng cho automation)
- Docs cũ (BUILD.md, `CONTRIBUTING.md đã lỗi thời)
- `css/`, img (web-specific)

**Cleanup Recommendation từ tôi:**
```
🗑️ DELETE: _config.yml, Gemfile, BUILD.md, CONTRIBUTING.md, 
   _layouts/, _includes/, css/, img/, 
   *.html (trừ khả năng future viewer), 
   js/translators.js, js/youtube-metadata*.js
   
✅ KEEP: js/youtube-api-v3.js, js/shared.js, 
   LICENSE, README.md


// Pseudocode: Diff Logic
async function compareSnapshots(playlistId, oldSnapshot, newSnapshot) {
  const oldVideoIds = Object.keys(oldSnapshot.videos);
  const newVideoIds = Object.keys(newSnapshot.videos);
  
  const diff = {
    added: [],           // Video mới thêm vào playlist
    removedManually: [], // Video bị remove thủ công
    deleted: [],         // Video bị xóa/private (vẫn trong playlist)
    unchanged: []        // Video vẫn ok
  };
  
  // Check videos trong OLD snapshot
  for (const videoId of oldVideoIds) {
    const inNew = newVideoIds.includes(videoId);
    
    if (!inNew) {
      // Video ID KHÔNG CÒN trong playlist
      // → Remove thủ công
      diff.removedManually.push({
        videoId,
        lastKnownTitle: oldSnapshot.videos[videoId].title,
        removedAt: new Date().toISOString()
      });
    } else {
      // Video ID VẪN CÒN trong playlist
      const newVideo = newSnapshot.videos[videoId];
      
      if (newVideo.status === 'deleted' || newVideo.status === 'private') {
        // Video bị xóa/private
        diff.deleted.push({
          videoId,
          lastKnownTitle: oldSnapshot.videos[videoId].title,
          newStatus: newVideo.status,
          detectedAt: new Date().toISOString()
        });
      } else {
        diff.unchanged.push(videoId);
      }
    }
  }
  
  // Check videos MỚI trong NEW snapshot
  for (const videoId of newVideoIds) {
    if (!oldVideoIds.includes(videoId)) {
      diff.added.push({
        videoId,
        title: newSnapshot.videos[videoId].title,
        addedAt: new Date().toISOString()
      });
    }
  }
  
  return diff;
}