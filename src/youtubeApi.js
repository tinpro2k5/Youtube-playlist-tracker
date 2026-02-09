/**
 * Lightweight YouTube Data API v3 wrapper for Node.js
 * - Uses fetch + async/await
 * - OAuth bearer token auth
 * - Convenience helpers for playlistItems, videos, playlists
 */
import crypto from 'crypto';

const DEFAULT_BASE_URL = 'https://www.googleapis.com/youtube/v3/';
const DEFAULT_TIMEOUT_MS = 5000;

// Generate a random string for quotaUser if not set via env or explicitly.
const randomId = (length = 40) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);

let baseUrl = DEFAULT_BASE_URL;
let accessToken = '';
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

async function request(endpoint, params = {}, { timeoutMs = DEFAULT_TIMEOUT_MS, signal, accessToken: tokenOverride } = {}) {
    const token = tokenOverride || accessToken;
    if (!token) {
        throw new Error('YouTube access token missing. Set it via setAccessToken() or pass accessToken in request options.');
    }

    const { accessToken: _ignored, ...queryParams } = params;
    const url = buildUrl(endpoint, { quotaUser, ...queryParams });

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const effectiveSignal = signal ? AbortSignal.any([signal, timeoutController.signal]) : timeoutController.signal;

    try {
        const response = await fetch(url, {
            method: 'GET',
            signal: effectiveSignal,
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
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

const setAccessToken = (token) => {
    accessToken = token;
};

const getAccessToken = () => accessToken;

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
    setAccessToken,
    getAccessToken,
    setQuotaUser,
    getQuotaUser,
    request,
    playlistItems,
    videos,
    playlists
};

export default youtube;
