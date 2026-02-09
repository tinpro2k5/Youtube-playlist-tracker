import fs from 'node:fs';
import path from 'node:path';

const THUMBNAIL_DIR = path.resolve(process.cwd(), 'data', 'assets', 'thumbnails');

const ensureDir = (dirPath) => {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
};

const pickThumbnailUrl = (thumbnails) => {
	if (!thumbnails) return '';
	return thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || '';
};

const getExtension = (url) => {
	try {
		const parsed = new URL(url);
		const ext = path.extname(parsed.pathname);
		return ext || '.jpg';
	} catch (_) {
		return '.jpg';
	}
};

export const downloadThumbnail = async (videoId, thumbnails) => {
	const url = pickThumbnailUrl(thumbnails);
	if (!url) return '';

	ensureDir(THUMBNAIL_DIR);
	const ext = getExtension(url);
	const fileName = `${videoId}${ext}`;
	const filePath = path.join(THUMBNAIL_DIR, fileName);

	if (fs.existsSync(filePath)) {
		return path.join('data', 'assets', 'thumbnails', fileName).replace(/\\/g, '/');
	}

	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download thumbnail (${response.status}) for ${videoId}.`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	fs.writeFileSync(filePath, buffer);
	return path.join('data', 'assets', 'thumbnails', fileName).replace(/\\/g, '/');
};

export default {
	downloadThumbnail
};
