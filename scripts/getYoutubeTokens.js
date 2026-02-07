/**
 * CLI helper to obtain YouTube OAuth2 tokens.
 * Flow: prints consent URL → you paste auth code → exchanges for access/refresh tokens.
 *
 * Usage:
 *   npm run youtube:auth
 *   npm run youtube:auth -- --scopes="https://www.googleapis.com/auth/youtube.readonly"
 */
import fs from 'node:fs';
import path from 'node:path';
import fetch from 'node-fetch';
import readline from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';
import dotenv from 'dotenv';

const ENV_PATH = path.resolve('config/.env');
dotenv.config({path: ENV_PATH});

const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];
const SECRET_FILE = path.resolve('config/secret/client_secret_130090101339-vhmssnkphv2nm7ja212m91qscc41ckn2.apps.googleusercontent.com.json');

const loadInstalledCredentials = () => {
    try {
        const raw = fs.readFileSync(SECRET_FILE, 'utf8');
        const json = JSON.parse(raw);
        return json.installed || {};
    } catch (_) {
        return {};
    }
};

const installed = loadInstalledCredentials();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || installed.client_id;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || installed.client_secret;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || (installed.redirect_uris && installed.redirect_uris[0]) || 'http://localhost';

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing client credentials. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET or add the client_secret JSON.');
    process.exit(1);
}

const parseScopes = () => {
    const flag = process.argv.find(arg => arg.startsWith('--scopes='));
    if (!flag) return DEFAULT_SCOPES;
    return flag.replace('--scopes=', '').split(',').map(s => s.trim()).filter(Boolean);
};

const buildAuthUrl = (scopes) => {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes.join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    return url.toString();
};

const exchangeCodeForTokens = async (code) => {
    const body = new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token exchange failed (${res.status}): ${text}`);
    }

    return res.json();
};

const persistRefreshToken = (refreshToken) => {
    if (!refreshToken) return;
    const envLines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) : [];
    const otherLines = envLines.filter(line => !line.trim().startsWith('GOOGLE_REFRESH_TOKEN'));
    otherLines.push(`GOOGLE_REFRESH_TOKEN=${refreshToken}`);
    fs.writeFileSync(ENV_PATH, otherLines.join('\n'), 'utf8');
    console.log(`Saved refresh token to ${ENV_PATH}`);
};

const main = async () => {
    const scopes = parseScopes();
    const authUrl = buildAuthUrl(scopes);
    console.log('1) Open this URL in your browser and approve access:');
    console.log(authUrl);
    console.log('\n2) After consenting, copy the "code" parameter from the redirect URL and paste below.\n');

    const rl = readline.createInterface({input, output});
    const code = (await rl.question('Enter the authorization code: ')).trim();
    rl.close();

    if (!code) {
        console.error('No code provided. Aborting.');
        process.exit(1);
    }

    try {
        const tokens = await exchangeCodeForTokens(code);
        console.log('\nAccess token:', tokens.access_token);
        console.log('Expires in (s):', tokens.expires_in);
        if (tokens.refresh_token) {
            console.log('Refresh token:', tokens.refresh_token);
            persistRefreshToken(tokens.refresh_token);
        } else {
            console.warn('No refresh token returned. Re-run with prompt=consent and access_type=offline or revoke prior consent.');
        }
    } catch (err) {
        console.error('Error exchanging code:', err.message);
        process.exit(1);
    }
};

main();
