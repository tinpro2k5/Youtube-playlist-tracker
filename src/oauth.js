import fs from 'node:fs';
import path from 'node:path';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

const readEnv = () => ({
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    accessToken: process.env.GOOGLE_ACCESS_TOKEN || ''
});

const exchangeRefreshToken = async ({ clientId, clientSecret, refreshToken }) => {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
    });

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.error_description || payload?.error || response.statusText;
        throw new Error(`OAuth token refresh failed (${response.status}): ${message}`);
    }

    if (!payload?.access_token) {
        throw new Error('OAuth token refresh did not return access_token.');
    }

    return payload.access_token;
};

export const getAccessToken = async () => {
    const { clientId, clientSecret, refreshToken, accessToken } = readEnv();

    if (accessToken) {
        return accessToken;
    }

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Missing OAuth env. Need GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN.');
    }

    return exchangeRefreshToken({ clientId, clientSecret, refreshToken });
};

export const loadAccessTokenFromFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) {
        return '';
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw.trim();
};

export const resolveRootPath = (...parts) => path.resolve(process.cwd(), ...parts);
