import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import logger from '../utils/logger.js';

const appRoot = new URL('../../App/', import.meta.url).pathname;
const configPath = path.join(appRoot, 'config.json');

/** 
 * Dynamically import a post‑process module (ESM or CJS). 
 */
async function loadModule(source) {
    try {
        const specifier = (source.startsWith('.') || source.startsWith('/'))
            ? pathToFileURL(path.resolve(appRoot, source)).href
            : source;

        const mod = await import(specifier).catch(err => {
            if (err.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module/.test(err.message)) {
                return import(pathToFileURL(path.resolve(appRoot, source)).href);
            }
            throw err;
        });

        return mod.default || mod;
    } catch (err) {
        logger.warn(`⚠️ Failed to load post‑process module "${source}": ${err.message}`);
        return null;
    }
}

/**
 * Run all configured post‑processors on the given HTML.
 * Each module can either:
 *   – be a function(html, componentMeta, outputPath) that returns newHtml
 *   – export an object with a .process(html, componentMeta, outputPath) method
 *
 * @returns {Promise<string>} the transformed HTML
 */
async function run(html, componentMeta, outputPath) {
    if (!existsSync(configPath)) return html;

    let config;
    try {
        const raw = await fs.readFile(configPath, 'utf8');
        config = JSON.parse(raw);
    } catch (err) {
        logger.error(`❌ Couldn’t read postProcess config: ${err.message}`);
        return html;
    }

    const pp = config.postProcess;
    if (!pp?.enabled || !Array.isArray(pp.sources)) return html;

    let result = html;
    for (const source of pp.sources) {
        const module = await loadModule(source);
        if (!module) continue;

        try {
            if (typeof module === 'function') {
                result = await module(result, componentMeta, outputPath);
            } else if (typeof module.process === 'function') {
                result = await module.process(result, componentMeta, outputPath);
            } else {
                logger.warn(`⚠️ Post‑process module "${source}" has no callable entrypoint`);
            }
        } catch (err) {
            logger.error(`❌ Error in post‑process "${source}":`, err);
        }
    }

    return result;
}

export default { run };
