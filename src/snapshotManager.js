import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

const SNAPSHOT_DIR = path.resolve(process.cwd(), 'data', 'snapshots');

const ensureDir = (dirPath) => {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
};

const getSnapshotPath = (playlistId) => path.join(SNAPSHOT_DIR, `${playlistId}.json`);

export const loadSnapshot = (playlistId) => {
	const filePath = getSnapshotPath(playlistId);
	if (!fs.existsSync(filePath)) {
		return null;
	}

	try {
		const raw = fs.readFileSync(filePath, 'utf8');
		return JSON.parse(raw);
	} catch (err) {
		logger.error(`Failed to load snapshot for ${playlistId}`, err.message);
		return null;
	}
};

export const saveSnapshot = (playlistId, snapshot) => {
	ensureDir(SNAPSHOT_DIR);
	const filePath = getSnapshotPath(playlistId);
	const content = JSON.stringify(snapshot, null, 2);
	fs.writeFileSync(filePath, content, 'utf8');
	return filePath;
};

export const snapshotManager = {
	loadSnapshot,
	saveSnapshot
};

export default snapshotManager;
