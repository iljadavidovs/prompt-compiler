import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import logger from '../utils/logger.js';

const appRoot = new URL('../../App/', import.meta.url).pathname;
const configPath = path.resolve(appRoot, 'config.json');

/**
 * Dynamically import a rule module (ESM or CJS)
 * @param {string} source - Package name or relative path to rule file
 * @returns {Promise<any|null>} Loaded module or null
 */
async function loadRuleModule(source) {
    try {
        // Determine specifier: package or file URL
        const specifier = (source.startsWith('.') || source.startsWith('/'))
            ? pathToFileURL(path.resolve(appRoot, source)).href
            : source;

        // Attempt import, falling back to file path on not found
        const mod = await import(specifier).catch(err => {
            if (err.code === 'ERR_MODULE_NOT_FOUND' || /Cannot find module/.test(err.message)) {
                const fileUrl = pathToFileURL(path.resolve(appRoot, source)).href;
                return import(fileUrl);
            }
            throw err;
        });

        return mod.default || mod;
    } catch (err) {
        return null;
    }
}

/**
 * Run all enabled rules against rendered HTML and component metadata
 * @param {string} renderedHTML
 * @param {object} componentMeta
 * @returns {Promise<Array<{name:string,description:string,error:any}>>}
 */
async function run(renderedHTML, componentMeta) {
    if (!existsSync(configPath)) return [];

    let config;
    try {
        const raw = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(raw);
    } catch (err) {
        logger.error(`❌ Error reading config: ${configPath}`, err);
        return [];
    }

    // No config → no rules
    const ruleConfig = config.rules;
    if (!ruleConfig?.enabled) return [];

    // Load each rule source (package or relative path)
    const errors = [];
    const ruleSet = [];
    for (const source of ruleConfig.sources || []) {
        const ruleModule = await loadRuleModule(source);
        if (!ruleModule) {
            logger.warn(`⚠️ Failed to load rule: ${source}`);
            continue;
        }
        ruleSet.push(...(Array.isArray(ruleModule) ? ruleModule : [ruleModule]));
    }

    // Execute all loaded rules
    for (const rule of ruleSet) {
        try {
            const result = rule.check(renderedHTML, componentMeta);
            if (result) {
                errors.push({
                    name: rule.name || 'unnamed-rule',
                    description: rule.description || '',
                    error: result
                });
            }
        } catch (err) {
            logger.warn(`⚠️ Rule "${rule.name}" threw an error:`, err);
        }
    }

    return errors;
}

export default { run };
