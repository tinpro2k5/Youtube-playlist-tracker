import dotenv from 'dotenv';
import youtube from './youtubeApi.js';
import { loadConfig } from './config.js';
import { getAccessToken } from './oauth.js';
import { trackPlaylist } from './playlistTracker.js';
import { logger } from './logger.js';

dotenv.config();

const main = async () => {
	const { playlists } = loadConfig();
	const accessToken = await getAccessToken();

	youtube.setAccessToken(accessToken);

	for (const playlist of playlists) {
		try {
			logger.info(`Tracking playlist ${playlist.id}`);
			const snapshot = await trackPlaylist(playlist);
			logger.info(`Snapshot saved for ${playlist.id}`, snapshot.stats);
		} catch (err) {
			logger.error(`Failed to track playlist ${playlist.id}`, err.message);
		}
	}
};

main().catch((err) => {
	logger.error('Fatal error running tracker', err.message);
	process.exit(1);
});