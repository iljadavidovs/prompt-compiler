import fs from 'fs';
import fetch from 'node-fetch';

const configPath = new URL('../../App/config.json', import.meta.url).pathname;

let envConfig = {};
try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    envConfig = JSON.parse(raw);
} catch {
    envConfig = {};
}

const apiGroups = envConfig.apiGroups || {};

/**
 * Fetches JSON data from a configured API group
 * @param {string} group    - Key in apiGroups for base URL
 * @param {string} endpoint - Path to append to the base URL
 * @returns {Promise<any>}  - Parsed JSON response
 * @throws {Error}         - When group is undefined or fetch fails
 */
export async function fetchData(group, endpoint) {
    const base = apiGroups[group];
    if (!base) {
        throw new Error(`API group "${group}" not found in config.json`);
    }

    const url = `${base}${endpoint}`;
    const res = await fetch(url);

    if (!res.ok) {
        throw new Error(`Fetch failed: ${res.status}`);
    }

    return res.json();
}
