import fs from 'fs';
import path from 'path';

import fsExtra from 'fs-extra';

import ComponentLoader from './ComponentLoader.js';
import PostProcess from '../PostProcess/PostProcess.js';
import Rules from '../Rules/Rules.js';
import { injectAuthScript } from '../Auth/index.js';
import { loadApiData } from '../Api/index.js';
import { parseLogicBlocks } from '../utils/logic.js';
import { protectCodeBlocks, restoreCodeBlocks } from "../utils/markup.js";
import { writeFile, ensureDir } from '../utils/fileIO.js';
import logger from '../utils/logger.js';

const coreDir = new URL('../../Core/', import.meta.url).pathname;
const pubDir = new URL('../../../Pub/', import.meta.url).pathname;
const appRoot = new URL('../../App/', import.meta.url).pathname;
const configPath = new URL('../../App/config.json', import.meta.url).pathname;

// Check for and load config
if (!fs.existsSync(configPath)) {
    logger.info(`No config file is present.`);
}
let config = {};
let ruleConfig;
try {
    const raw = await fs.promises.readFile(configPath, 'utf-8');
    config = JSON.parse(raw);
    ruleConfig = config.rules || {};
} catch {
    logger.info('No config file found — using defaults.');
}

export default class Renderer {

    static env = 'dev';

    static async renderAll(env = 'dev') {
        this.env = env;
        const outputDir = path.join(pubDir, env);

        logger.info(`Starting render process for environment: ${env}`);

        // Load components to render
        const componentsToRender = ComponentLoader.getRenderableComponents(appRoot);
        logger.info(`Found ${componentsToRender.length} components to render.`);

        // Determine the temporary directory
        const tmpOutputDir = path.join(pubDir, 'tmp');

        // Ensure temporary directory exists
        await ensureDir(tmpOutputDir);

        // Render each component to the tmp directory
        for (const component of componentsToRender) {
            if (component.config?.render !== true) {
                logger.info(`Skipping ${component.name} (render: false or not set)`);
                continue;
            }

            let renderedHTML = await Renderer.renderComponent(component, componentsToRender);
            const outputFilePath = path.join(tmpOutputDir, component.outputPath);
            const ruleFailures = await Rules.run(renderedHTML, component);

            if (ruleFailures.length) {
                const isStrictMode = env === 'prod' || ruleConfig?.strict;

                logger[isStrictMode ? 'error' : 'warn'](
                    isStrictMode
                        ? '❌ Build failed due to rule violations:'
                        : '⚠️ Rule warnings detected:'
                );

                ruleFailures.forEach(failure => logger[isStrictMode ? 'error' : 'warn'](failure));

                if (isStrictMode) {
                    if (fs.existsSync(tmpOutputDir)) await fsExtra.remove(tmpOutputDir);
                    process.exit(1);
                }
            }

            const injections = [];

            if (component.config?.auth && config.auth?.endpoint) {
                injectAuthScript(component, config.auth.endpoint);
                if (component.authScript) injections.push(component.authScript);
            }
            if (component.apiScripts) {
                injections.push(component.apiScripts);
            }
            if (injections.length) {
                renderedHTML = renderedHTML.replace('</body>', `${injections.join('\n')}</body>`);
            }

            await ensureDir(path.dirname(outputFilePath));

            if (config.postProcess?.enabled) {
                renderedHTML = await PostProcess.run(renderedHTML, component, outputFilePath);
            }

            await writeFile(outputFilePath, renderedHTML);

            logger.info(`Rendered: ${component.name} → ${component.outputPath}`);
        }

        // Only after rules pass, move tmp to final directory
        await fsExtra.emptyDir(outputDir); // Clean existing folder
        await fsExtra.copy(tmpOutputDir, outputDir);
        await fsExtra.remove(tmpOutputDir); // Clean up tmp folder

        const coreFilesToCopy = [
            'State/Manager.js',
            'utils/globalState.js',
        ];

        const outputAssetsDir = path.join(outputDir, 'assets');

        for (const file of coreFilesToCopy) {
            const source = path.join(coreDir, file);
            const dest = path.join(outputAssetsDir, file);

            await fsExtra.ensureDir(path.dirname(dest));
            await fsExtra.copy(source, dest);
        }

        logger.success(`Core scripts copied selectively to /Pub/${env}/assets`);

        const appAssetsSrc = path.join(appRoot, 'assets');
        const outputAppAssetsDir = path.join(outputDir, 'assets');

        if (await fsExtra.pathExists(appAssetsSrc)) {
            const entries = await fs.promises.readdir(appAssetsSrc);
            if (entries.length) {
                await fsExtra.ensureDir(outputAppAssetsDir);
                await fsExtra.copy(appAssetsSrc, outputAppAssetsDir);
                logger.success(`App assets copied recursively to /Pub/${env}/assets`);
            }
        }

        logger.success(`Build complete. Output saved to: /Pub/${env}`);
    }

    static async renderComponent(
        component,
        allComponents,
        data = {},
        innerContent = '',
        codeStore = [],
        isRoot = true
    ) {
        // 1. Load HTML synchronously
        const componentHTMLPath = path.resolve(component.path, component.entryFile || 'index.html');
        let htmlContent = fs.readFileSync(componentHTMLPath, 'utf8');

        // Protect code/pre blocks
        ({ safe: htmlContent } = protectCodeBlocks(htmlContent, codeStore));

        // Remove all HTML comments
        htmlContent = htmlContent.replace(/<!--[\s\S]*?-->/g, '');

        await loadApiData(component, config);

        // Combine config and passed-in data
        const combinedData = {
            ...(component.config || {}),
            ...(component.data || {}),
            ...data // incoming overrides still take precedence
        };

        // Regex for nested components: @{Name} or @{Name: {...}}
        const componentRegex = /@\{([\w\d_-]+)(?::\s*(\{.*?\}))?\}/g;

        // 2. Replace nested components (sync recursion)
        // Collect matches first, then replace. Avoids the “mutating while matching” bug.
        const matches = [...htmlContent.matchAll(componentRegex)];
        for (const match of matches) {
            const [placeholder, componentName, dataString] = match;

            const nestedComponent = allComponents.find(c => c.name === componentName);
            if (!nestedComponent) {
                logger.warn(`Component "${componentName}" not found.`);
                htmlContent = htmlContent.replace(placeholder, '');
                continue;
            }

            let nestedData = {};
            if (dataString) {
                try {
                    nestedData = JSON.parse(dataString);
                } catch (error) {
                    logger.error(`JSON parsing error for "${componentName}":`, error);
                }
            }

            // Recursively render the nested component
            const nestedHtml = await Renderer.renderComponent(nestedComponent, allComponents, nestedData, '', codeStore, false);
            // Replace the placeholder in this component's HTML
            htmlContent = htmlContent.replace(placeholder, nestedHtml);
        }

        // 3. Insert any innerContent via @[content]
        if (innerContent) {
            htmlContent = htmlContent.replace('@[content]', innerContent);
        }

        htmlContent = parseLogicBlocks(htmlContent, combinedData);

        // 4. Replace data placeholders @[someKey] or @[nested.obj.key]
        const dataPlaceholderRegex = /@\[(.+?)\]/g;
        htmlContent = htmlContent.replace(dataPlaceholderRegex, (_, key) => {
            const value = key.split('.').reduce((obj, k) => (obj || {})[k], combinedData);
            return value !== undefined ? value : '';
        });

        // 5. If the component extends a base component, do another pass
        const baseComponentName = component.config?.extends;
        if (baseComponentName) {
            const baseComponent = allComponents.find(c => c.name === baseComponentName);
            if (baseComponent) {
                // Recursively render the base with our final HTML as its @[content]
                htmlContent = await Renderer.renderComponent(baseComponent, allComponents, combinedData, htmlContent, codeStore, false);
            } else {
                logger.warn(`Base component "${baseComponentName}" not found.`);
            }
        }

        htmlContent = htmlContent
            .replace(/@ENV@/g, this.env)
            .replace(/@ASSETS@/g, `/${this.env}/assets`);

        // Restore code/pre blocks
        if (isRoot) htmlContent = restoreCodeBlocks(htmlContent, codeStore);

        return htmlContent;
    }
}
