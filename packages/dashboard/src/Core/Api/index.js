import { fetchData } from './fetcher.js';
import { generateClientPost } from './poster.js';

/**
 * Populates component.data from configured API sources and attaches client-side post scripts
 * @param {object} component - Component metadata including config and data
 * @param {object} config - Global configuration containing apiAuth and apiGroups
 */
export async function loadApiData(component, config) {
    const apiConfig = component.config?.api;
    if (!apiConfig || !Array.isArray(apiConfig)) return;

    component.apiScripts = [];

    for (const entry of apiConfig) {
        const { dataGroup, dataSource, getType, postType, injectAs, postName } = entry;

        // Fetch data for 'static' or 'dynamic' sources
        if (getType === 'static' || getType === 'dynamic') {
            try {
                const result = await fetchData(dataGroup, dataSource);
                component.data = component.data || {};
                component.data[injectAs || dataSource.replace(/\W/g, '')] = result;
            } catch (err) {
                console.error(`❌ API fetch failed for ${dataSource}:`, err.message);
            }
        }

        // Generate client-side post script if configured
        if (postType) {
            const groupAuthKey = config.apiAuth?.[dataGroup]?.token;
            const envToken = process.env[groupAuthKey];
            const token = envToken || '';
            const name = postName || 'postTo' + dataSource.replace(/\W/g, '');
            const urlBase = config.apiGroups?.[dataGroup] || '';

            component.apiScripts.push(
                generateClientPost(name, urlBase, dataSource, token)
            );
        }
    }
}
