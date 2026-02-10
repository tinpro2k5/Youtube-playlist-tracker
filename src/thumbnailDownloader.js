import path from 'node:path';
import { uploadFile, fileExists } from './b2Storage.js';
import { logger } from './logger.js';

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

const getContentType = (ext) => {
	const types = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp'
	};
	return types[ext.toLowerCase()] || 'image/jpeg';
};

const buildPublicUrl = (fileName) => {
	return `${process.env.B2_DOWNLOAD_URL}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
};

/**
 * Download and upload thumbnail to B2
 * @param {string} videoId - YouTube video ID
 * @param {object} thumbnails - Thumbnails object from YouTube API
 * @param {string} existingPath - Existing thumbnail path from previous snapshot
 * @returns {Promise<string>} - B2 public URL of the uploaded thumbnail
 */
export const downloadThumbnail = async (videoId, thumbnails, existingPath = '') => {
	const url = pickThumbnailUrl(thumbnails);
	if (!url) return '';

	// Early return if we already have a valid B2 URL from previous snapshot
	if (existingPath && existingPath.startsWith('http')) {
		return existingPath;
	}

	const ext = getExtension(url);
	const fileName = `thumbnails/${videoId}${ext}`;
	const publicUrl = buildPublicUrl(fileName);

	// Check if already uploaded to B2
	try {
		const exists = await fileExists(fileName);
		if (exists) {
			logger.info(`Thumbnail already exists in B2 for ${videoId}`);
			return publicUrl;
		}
	} catch (err) {
		logger.warn(`Could not check if thumbnail exists in B2 for ${videoId}`, err.message);
	}

	// Download from YouTube
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to download thumbnail (${response.status}) for ${videoId}.`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	const contentType = getContentType(ext);

	// Upload to B2
	const uploadedUrl = await uploadFile(buffer, fileName, contentType);

	return uploadedUrl;
};

export default {
	downloadThumbnail
};
