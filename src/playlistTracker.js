import youtube from './youtubeApi.js';
import { loadSnapshot, saveSnapshot } from './snapshotManager.js';
import { downloadThumbnail } from './thumbnailDownloader.js';
import { logger } from './logger.js';

const MAX_RESULTS = 50;

const getVideoIdFromItem = (item) => {
	return item?.snippet?.resourceId?.videoId || item?.contentDetails?.videoId || '';
};

const normalizeTitle = (title) => String(title || '').toLowerCase();

const detectMissingStatus = (playlistItem) => {
	const title = normalizeTitle(playlistItem?.snippet?.title);
	if (title.includes('private video')) {
		return 'private';
	}
	if (title.includes('deleted video')) {
		return 'deleted';
	}
	return 'deleted';
};

const fetchPlaylistItems = async (playlistId) => {
	let items = [];
	let pageToken = '';

	do {
		const res = await youtube.playlistItems({
			part: 'snippet,contentDetails',
			maxResults: MAX_RESULTS,
			playlistId,
			pageToken
		});
		items = items.concat(res.items || []);
		pageToken = res.nextPageToken || '';
	} while (pageToken);

	return items;
};

const fetchVideoDetails = async (videoIds) => {
	const map = {};
	for (let i = 0; i < videoIds.length; i += MAX_RESULTS) {
		const batch = videoIds.slice(i, i + MAX_RESULTS);
		if (batch.length === 0) continue;
		const res = await youtube.videos({
			part: 'snippet,contentDetails,status',
			id: batch.join(',')
		});
		(res.items || []).forEach((item) => {
			map[item.id] = item;
		});
	}
	return map;
};

const fetchPlaylistTitle = async (playlistId) => {
	const res = await youtube.playlists({
		part: 'snippet',
		id: playlistId,
		maxResults: 1
	});
	return res.items?.[0]?.snippet?.title || '';
};

const buildStats = (videos, removedVideos) => {
	const stats = {
		totalVideos: Object.keys(videos).length,
		activeVideos: 0,
		deletedVideos: 0,
		privateVideos: 0,
		removedVideos: Object.keys(removedVideos).length
	};

	Object.values(videos).forEach((video) => {
		if (video.status === 'ok') stats.activeVideos += 1;
		if (video.status === 'deleted') stats.deletedVideos += 1;
		if (video.status === 'private') stats.privateVideos += 1;
	});

	return stats;
};

export const trackPlaylist = async ({ id, name }) => {
	const now = new Date().toISOString();
	const oldSnapshot = loadSnapshot(id) || { videos: {}, removedVideos: {} };
	const oldVideos = oldSnapshot.videos || {};
	const removedVideos = { ...(oldSnapshot.removedVideos || {}) };

	const items = await fetchPlaylistItems(id);
	const currentIds = items.map(getVideoIdFromItem).filter(Boolean);
	const videoMap = await fetchVideoDetails(currentIds);

	const playlistTitle = name || oldSnapshot.playlistTitle || (await fetchPlaylistTitle(id));

	const videos = {};
	for (const item of items) {
		const videoId = getVideoIdFromItem(item);
		if (!videoId) continue;

		if (removedVideos[videoId]) {
			delete removedVideos[videoId];
		}

		const detail = videoMap[videoId];
		const oldVideo = oldVideos[videoId];

		if (detail) {
			const thumbnails = detail.snippet?.thumbnails || {};
			let thumbnailPath = oldVideo?.assets?.thumbnailPath || '';
			if (!thumbnailPath) {
				try {
					thumbnailPath = await downloadThumbnail(videoId, thumbnails);
				} catch (err) {
					logger.warn(`Thumbnail download failed for ${videoId}`, err.message);
				}
			}

			videos[videoId] = {
				title: detail.snippet?.title || oldVideo?.title || '',
				channelId: detail.snippet?.channelId || oldVideo?.channelId || '',
				channelTitle: detail.snippet?.channelTitle || oldVideo?.channelTitle || '',
				publishedAt: detail.snippet?.publishedAt || oldVideo?.publishedAt || null,
				thumbnails,
				status: 'ok',
				firstSeenAt: oldVideo?.firstSeenAt || now,
				lastSeenAt: now,
				assets: {
					thumbnailPath: thumbnailPath || null,
					previewClipPath: null
				}
			};
			continue;
		}

		const missingStatus = detectMissingStatus(item);
		const lastKnownTitle = oldVideo?.title || oldVideo?.metadata?.lastKnownTitle || item?.snippet?.title || '';
		const lastKnownChannel = oldVideo?.channelTitle || oldVideo?.metadata?.lastKnownChannel || '';
		const deletedAt = missingStatus === 'deleted' ? (oldVideo?.deletedAt || now) : undefined;
		const privateAt = missingStatus === 'private' ? (oldVideo?.privateAt || now) : undefined;

		videos[videoId] = {
			title: item?.snippet?.title || lastKnownTitle || '',
			channelId: oldVideo?.channelId || '',
			channelTitle: oldVideo?.channelTitle || '',
			publishedAt: oldVideo?.publishedAt || null,
			thumbnails: oldVideo?.thumbnails || {},
			status: missingStatus,
			firstSeenAt: oldVideo?.firstSeenAt || now,
			lastSeenAt: oldVideo?.lastSeenAt || now,
			...(deletedAt ? { deletedAt } : {}),
			...(privateAt ? { privateAt } : {}),
			metadata: {
				lastKnownTitle,
				lastKnownChannel,
				thumbnailPath: oldVideo?.assets?.thumbnailPath || null
			},
			assets: {
				thumbnailPath: oldVideo?.assets?.thumbnailPath || null,
				previewClipPath: null
			}
		};
	}

	for (const [videoId, oldVideo] of Object.entries(oldVideos)) {
		if (currentIds.includes(videoId)) continue;

		const lastKnownTitle = oldVideo?.title || oldVideo?.metadata?.lastKnownTitle || '';
		const lastKnownChannel = oldVideo?.channelTitle || oldVideo?.metadata?.lastKnownChannel || '';

		removedVideos[videoId] = {
			title: lastKnownTitle,
			channelId: oldVideo?.channelId || '',
			channelTitle: oldVideo?.channelTitle || '',
			status: 'removed_manually',
			firstSeenAt: oldVideo?.firstSeenAt || now,
			lastSeenAt: oldVideo?.lastSeenAt || now,
			removedAt: oldVideo?.removedAt || now,
			...(oldVideo?.deletedAt ? { deletedAt: oldVideo.deletedAt } : {}),
			...(oldVideo?.privateAt ? { privateAt: oldVideo.privateAt } : {}),
			metadata: {
				lastKnownTitle,
				lastKnownChannel,
				thumbnailPath: oldVideo?.assets?.thumbnailPath || null
			},
			assets: {
				thumbnailPath: oldVideo?.assets?.thumbnailPath || null,
				previewClipPath: null
			}
		};
	}

	const snapshot = {
		playlistId: id,
		playlistTitle,
		lastFetchedAt: now,
		videos,
		removedVideos
	};

	snapshot.stats = buildStats(videos, removedVideos);

	saveSnapshot(id, snapshot);
	return snapshot;
};

export default {
	trackPlaylist
};
