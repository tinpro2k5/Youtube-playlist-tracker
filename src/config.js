import fs from 'node:fs';
import path from 'node:path';

const CONFIG_PATH = path.resolve(process.cwd(), 'config', 'playlists.json');

const readJsonFile = (filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
};

export const loadConfig = () => {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error(`Missing config file: ${CONFIG_PATH}`);
    }

    const config = readJsonFile(CONFIG_PATH);
    const playlists = Array.isArray(config.playlists) ? config.playlists : [];

    if (playlists.length === 0) {
        throw new Error('Config playlists is empty. Add playlist ids to config/playlists.json.');
    }

    const normalized = playlists.map((item) => {
        if (!item || !item.id) {
            throw new Error('Each playlist entry must include an id.');
        }
        return {
            id: String(item.id).trim(),
            name: item.name ? String(item.name).trim() : ''
        };
    });

    return { playlists: normalized };
};
