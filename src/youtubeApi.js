/**
 * Lightweight YouTube Data API v3 wrapper for Node.js
 * - No jQuery / browser APIs
 * - Uses fetch + async/await
 * - Convenience helpers for playlistItems, videos, playlists
 */
import crypto from 'crypto';

const DEFAULT_BASE_URL = 'https://www.googleapis.com/youtube/v3/';
const DEFAULT_TIMEOUT_MS = 5000;

// Generate a random string for quotaUser if not set via env or explicitly. This helps distribute quota usage across multiple instances.
const randomId = (length = 40) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

let baseUrl = DEFAULT_BASE_URL;
let apiKey = process.env.YT_API_KEY || process.env.YOUTUBE_API_KEY || '';
let quotaUser = process.env.YT_QUOTA_USER || randomId();

const normalizeBaseUrl = (url) => (url.endsWith('/') ? url : `${url}/`);

const buildUrl = (endpoint, params) => {
    const url = new URL(endpoint, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            url.searchParams.set(key, value);
        }
    });
    return url.toString();
};

const safeParseJson = async (response) => {
    try {
        const clone = response.clone();
        return await clone.json();
    } catch (_) {
        return null;
    }
};

async function request(endpoint, params = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {}) {
    const key = params.key || apiKey;
    if (!key) {
        throw new Error('YouTube API key missing. Set it via setKey() or env YT_API_KEY.');
    }

    const url = buildUrl(endpoint, { key, quotaUser, ...params });

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

    try {
        const response = await fetch(url, { method: 'GET', signal: effectiveSignal });
        const payload = await safeParseJson(response);

        if (!response.ok) {
            const message = payload?.error?.message || response.statusText || 'Unknown error';
            const code = payload?.error?.code || response.status;
            throw new Error(`YouTube API error (${code}): ${message}`);
        }

        if (!payload) {
            throw new Error('YouTube API returned an empty response body.');
        }

        return payload;
    } catch (err) {
        if (err.name === 'AbortError') {
            throw new Error(`YouTube API request timed out after ${timeoutMs}ms.`);
        }
        throw err;
    } finally {
        clearTimeout(timeoutId);
    }
}

const setBaseUrl = (url) => {
    baseUrl = normalizeBaseUrl(url);
};

const getBaseUrl = () => baseUrl;

const setKey = (key) => {
    apiKey = key;
};

const getKey = () => apiKey;

const setQuotaUser = (id) => {
    quotaUser = id;
};

const getQuotaUser = () => quotaUser;

const playlistItems = (params) => request('playlistItems', params);
const videos = (params) => request('videos', params);
const playlists = (params) => request('playlists', params);

export const youtube = {
    setBaseUrl,
    getBaseUrl,
    setKey,
    getKey,
    setQuotaUser,
    getQuotaUser,
    request,
    playlistItems,
    videos,
    playlists
};

export default youtube;
