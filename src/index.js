import dotenv from 'dotenv';
import youtube from './youtubeApi.js';
import { fetchUserPlaylists } from './config.js';
import { getAccessToken } from './oauth.js';
import { trackPlaylist } from './playlistTracker.js';
import { logger } from './logger.js';

dotenv.config();

const main = async () => {
	const accessToken = await getAccessToken();
	youtube.setAccessToken(accessToken);

	const playlists = await fetchUserPlaylists(youtube);

	if (playlists.length === 0) {
		logger.warn('No playlists found for this account.');
		return;
	}

	logger.info(`Found ${playlists.length} playlist(s). Starting tracking...`);

	// Process playlists in parallel with concurrency limit
	const PLAYLIST_CONCURRENCY = parseInt(process.env.PLAYLIST_CONCURRENCY) || 3;
	let successCount = 0;
	let failureCount = 0;

	for (let i = 0; i < playlists.length; i += PLAYLIST_CONCURRENCY) {
		const batch = playlists.slice(i, i + PLAYLIST_CONCURRENCY);
		const results = await Promise.allSettled(batch.map(async (playlist) => {
			logger.info(`Tracking playlist ${playlist.id} - ${playlist.name}`);
			const snapshot = await trackPlaylist(playlist);
			logger.info(`Snapshot saved for ${playlist.id} - ${playlist.name}`, snapshot.stats);
			return snapshot;
		}));

		results.forEach((result, idx) => {
			if (result.status === 'fulfilled') {
				successCount++;
			} else {
				failureCount++;
				const playlist = batch[idx];
				logger.error(`Failed to track playlist ${playlist.id} - ${playlist.name}`, result.reason?.message || 'Unknown error');
			}
		});
	}

	logger.info(`Tracking complete: ${successCount} succeeded, ${failureCount} failed`);
};

main().catch((err) => {
	logger.error('Fatal error running tracker', err.message);
	process.exit(1);
});