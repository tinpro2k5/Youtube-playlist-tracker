import youtube from './youtubeApi.js';
import { loadSnapshot, saveSnapshot } from './snapshotManager.js';
import { downloadThumbnail } from './thumbnailDownloader.js';
import { logger } from './logger.js';

const MAX_RESULTS = 50;
const REMOVED_TTL_DAYS = 12;
const REMOVED_TTL_MS = REMOVED_TTL_DAYS * 24 * 60 * 60 * 1000;

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
	if (videoIds.length === 0) return {};

	// Split into batches
	const batches = [];
	for (let i = 0; i < videoIds.length; i += MAX_RESULTS) {
		batches.push(videoIds.slice(i, i + MAX_RESULTS));
	}

	// Fetch batches in parallel with concurrency limit
	const BATCH_CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY) || 3;
	const allResults = [];

	for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
		const batchGroup = batches.slice(i, i + BATCH_CONCURRENCY);
		const results = await Promise.all(batchGroup.map(batch =>
			youtube.videos({
				part: 'snippet,contentDetails,status',
				id: batch.join(',')
			})
		));
		allResults.push(...results);
	}

	// Merge all results into map
	const map = {};
	allResults.forEach(res => {
		(res.items || []).forEach((item) => {
			map[item.id] = item;
		});
	});
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

const pruneRemovedVideos = (removed, { ttlMs, maxSize } = {}) => {
	const cutoff = Date.now() - (ttlMs ?? REMOVED_TTL_MS);

	const entries = Object.entries(removed).filter(([, value]) => {
		const dateValue = value?.removedAt || value?.lastSeenAt || '';
		const timestamp = Date.parse(dateValue);
		if (!Number.isFinite(timestamp)) {
			return true;
		}
		return timestamp >= cutoff;
	});

	entries.sort((a, b) => {
		const aTime = Date.parse(a[1]?.removedAt || a[1]?.lastSeenAt || '') || 0;
		const bTime = Date.parse(b[1]?.removedAt || b[1]?.lastSeenAt || '') || 0;
		return bTime - aTime;
	});

	const limited = Number.isFinite(maxSize) ? entries.slice(0, maxSize) : entries;
	return Object.fromEntries(limited);
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

	// Prepare video processing tasks
	const videoTasks = items.map(item => ({
		item,
		videoId: getVideoIdFromItem(item),
		oldVideo: oldVideos[getVideoIdFromItem(item)]
	})).filter(task => task.videoId);

	// Download all thumbnails in parallel (with concurrency limit)
	const THUMBNAIL_CONCURRENCY = parseInt(process.env.THUMBNAIL_CONCURRENCY) || 10;
	const thumbnailResults = new Map();

	const thumbnailTasks = videoTasks
		.filter(({ videoId, oldVideo }) => {
			const detail = videoMap[videoId];
			return detail; // Only download for videos with details
		})
		.map(async ({ videoId, oldVideo }) => {
			const detail = videoMap[videoId];
			const thumbnails = detail.snippet?.thumbnails || {};
			const existingPath = oldVideo?.assets?.thumbnailPath || '';

			try {
				const path = await downloadThumbnail(videoId, thumbnails, existingPath);
				return { videoId, path };
			} catch (err) {
				logger.warn(`Thumbnail download failed for ${videoId}`, err.message);
				return { videoId, path: existingPath };
			}
		});

	// Process thumbnails in batches to avoid overwhelming B2
	for (let i = 0; i < thumbnailTasks.length; i += THUMBNAIL_CONCURRENCY) {
		const batch = thumbnailTasks.slice(i, i + THUMBNAIL_CONCURRENCY);
		const results = await Promise.all(batch);
		results.forEach(({ videoId, path }) => {
			thumbnailResults.set(videoId, path);
		});
	}

	// Build videos object with all data
	const videos = {};
	for (const { item, videoId, oldVideo } of videoTasks) {
		if (removedVideos[videoId]) {
			delete removedVideos[videoId];
		}

		const detail = videoMap[videoId];

		if (detail) {
			const thumbnailUrl = detail.snippet?.thumbnails?.high?.url ||
				detail.snippet?.thumbnails?.medium?.url ||
				detail.snippet?.thumbnails?.default?.url || '';
			const thumbnailPath = thumbnailResults.get(videoId) || '';

			videos[videoId] = {
				title: detail.snippet?.title || oldVideo?.title || '',
				channelId: detail.snippet?.channelId || oldVideo?.channelId || '',
				channelTitle: detail.snippet?.channelTitle || oldVideo?.channelTitle || '',
				publishedAt: detail.snippet?.publishedAt || oldVideo?.publishedAt || null,
				thumbnailUrl,
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
			thumbnailUrl: oldVideo?.thumbnailUrl || '',
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

	const prunedRemovedVideos = pruneRemovedVideos(removedVideos);
	const snapshot = {
		playlistId: id,
		playlistTitle,
		lastFetchedAt: now,
		videos,
		removedVideos: prunedRemovedVideos
	};

	snapshot.stats = buildStats(videos, prunedRemovedVideos);

	saveSnapshot(id, snapshot);
	return snapshot;
};

export default {
	trackPlaylist
};
