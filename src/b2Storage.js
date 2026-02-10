import crypto from 'crypto';
import { logger } from './logger.js';

const B2_API_URL = 'https://api.backblazeb2.com';

let authToken = null;
let apiUrl = null;
let downloadUrl = null;
let authExpiry = 0;

/**
 * Authorize with B2 API
 */
const authorize = async () => {
    const appKeyId = process.env.B2_APP_KEY_ID;
    const appKey = process.env.B2_APP_KEY;

    if (!appKeyId || !appKey) {
        throw new Error('Missing B2 credentials. Need B2_APP_KEY_ID and B2_APP_KEY in .env');
    }

    const credentials = Buffer.from(`${appKeyId}:${appKey}`).toString('base64');

    const response = await fetch(`${B2_API_URL}/b2api/v2/b2_authorize_account`, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${credentials}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`B2 authorization failed: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    authToken = data.authorizationToken;
    apiUrl = data.apiUrl;
    downloadUrl = data.downloadUrl;
    authExpiry = Date.now() + 23 * 60 * 60 * 1000; // 23 hours

    return data;
};

/**
 * Ensure we have a valid auth token
 */
const ensureAuth = async () => {
    if (!authToken || Date.now() >= authExpiry) {
        await authorize();
    }
};

/**
 * Get upload URL for a specific bucket
 */
const getUploadUrl = async (bucketId) => {
    await ensureAuth();

    const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: authToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Failed to get B2 upload URL: ${error.message || response.statusText}`);
    }

    return response.json();
};

/**
 * Upload a file buffer to B2
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} fileName - Name to save the file as
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<string>} - Public URL of the uploaded file
 */
export const uploadFile = async (buffer, fileName, contentType = 'image/jpeg') => {
    const bucketId = process.env.B2_BUCKET_ID;
    if (!bucketId) {
        throw new Error('Missing B2_BUCKET_ID in .env');
    }

    await ensureAuth();

    // Get upload credentials
    const uploadData = await getUploadUrl(bucketId);

    // Calculate SHA1 hash
    const hash = crypto.createHash('sha1').update(buffer).digest('hex');

    // Upload the file
    const response = await fetch(uploadData.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: uploadData.authorizationToken,
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'X-Bz-Content-Sha1': hash
        },
        body: buffer
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`B2 upload failed: ${error.message || response.statusText}`);
    }

    const result = await response.json();

    // Return the public URL
    const publicUrl = `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

    logger.info(`Uploaded ${fileName} to B2`, { fileId: result.fileId, size: buffer.length });

    return publicUrl;
};

/**
 * Check if a file exists in B2
 */
export const fileExists = async (fileName) => {
    await ensureAuth();

    const response = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
        method: 'POST',
        headers: {
            Authorization: authToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            bucketId: process.env.B2_BUCKET_ID,
            prefix: fileName,
            maxFileCount: 1
        })
    });

    if (!response.ok) {
        logger.error(`B2 file check failed: ${response.statusText}`);
        return false;
    }

    const data = await response.json();
    return data.files?.some(f => f.fileName === fileName) || false;
};

export default {
    uploadFile,
    fileExists
};
