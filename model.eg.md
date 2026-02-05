{
  "playlistId": "PLxxxx",
  "playlistTitle": "My Playlist",
  "lastFetchedAt": "2026-02-05T21:10:00+07:00",
  "videos": {
    // Videos hiện có trong playlist (active + deleted + private)
    "VIDEO_ID_1": {
      "title": "My Video Title",
      "channelId": "UCxxx",
      "channelTitle": "Channel Name",
      "publishedAt": "2020-01-01T00:00:00Z",
      "thumbnails": { "default": "url", "medium": "url", "high": "url" },
      "status": "ok",                    // ✅ Video ok
      "firstSeenAt": "2025-03-15T00:00:00Z",
      "lastSeen": "2026-02-05T21:10:00+07:00"
    },
    "VIDEO_ID_2": {
      "title": "Deleted video",          // YouTube API trả về placeholder
      "channelId": null,
      "channelTitle": null,
      "publishedAt": null,
      "thumbnails": {},
      "status": "deleted",               // ⚠️ Video bị xóa
      "firstSeenAt": "2025-03-15T00:00:00Z",
      "lastSeen": "2026-02-04T20:00:00+07:00",
      "metadata": {
        "lastKnownTitle": "Original Title",  // Lưu từ snapshot cũ
        "lastKnownChannel": "Original Channel"
        "thumbnailPath": "thumbnails/VIDEO_ID_2.jpg"
      }
    },
    "VIDEO_ID_3": {
      "title": "Private video",
      "channelId": null,
      "channelTitle": null,
      "publishedAt": null,
      "thumbnails": {},
      "status": "private",               // 🔒 Video bị private
      "firstSeenAt": "2025-03-15T00:00:00Z",
      "lastSeen": "2026-02-03T19:00:00+07:00",
      "metadata": {
        "lastKnownTitle": "Original Title",
        "lastKnownChannel": "Original Channel",
        "thumbnailPath": "thumbnails/VIDEO_ID_3.jpg"
      }
    }
  },
  "removedVideos": {
    // Videos đã bị remove khỏi playlist (KHÔNG còn trong playlistItems)
    "VIDEO_ID_4": {
      "title": "Manually Removed Video",
      "lastSeenInPlaylist": "2026-02-01T10:00:00+07:00",
      "removedAt": "2026-02-05T21:10:00+07:00",
      "status": "removed_manually",      // 🗑️ Remove thủ công
      "metadata": {
        "lastKnownTitle": "Original Title",
        "lastKnownChannel": "Channel Name",
        "thumbnailPath": "thumbnails/VIDEO_ID_4.jpg"
      }
    }
  }
}