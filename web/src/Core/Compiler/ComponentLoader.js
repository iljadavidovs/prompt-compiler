import fs from 'fs';
import path from 'path';

import logger from '../utils/logger.js';

export default class ComponentLoader {
    /**
     * Scan both app and core component directories to collect renderable components
     */
    static getRenderableComponents(appDir) {
        const components = [];
        const componentRoots = [
            // App-specific components
            path.resolve(appDir, 'Components'),
            // Core framework components
            new URL('../Components/', import.meta.url).pathname
        ];

        componentRoots.forEach((rootDir) => {
            if (!fs.existsSync(rootDir)) {
                logger.warn(`Components directory not found at ${rootDir}.`);
                return;
            }
            ComponentLoader.traverseDirectory(rootDir, components, rootDir);
        });

        return components;
    }

    /**
     * Recursively traverse a directory, collecting all .html component files
     */
    static traverseDirectory(currentPath, components, rootDir) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });

        // Process all .html files in this folder
        const htmlFiles = entries.filter(
            (e) => e.isFile() && e.name.endsWith('.html')
        );

        htmlFiles.forEach((file) => {
            const isIndex = file.name === 'index.html';
            const folderName = path.basename(currentPath);
            const fileBaseName = path.basename(file.name, '.html');
            let componentName, entryFile, outputPath;

            if (isIndex) {
                // index.html becomes the component for its folder
                componentName = folderName;
                entryFile = file.name;
                outputPath = path.relative(
                    rootDir,
                    path.join(currentPath, 'index.html')
                );
            } else {
                // other .html files are standalone components
                componentName = fileBaseName;
                entryFile = file.name;
                outputPath = path.relative(
                    rootDir,
                    path.join(currentPath, fileBaseName, entryFile)
                );
            }

            const config = ComponentLoader.loadConfig(
                currentPath,
                componentName
            );

            components.push({
                name: componentName,
                path: currentPath,
                entryFile,
                outputPath,
                config
            });

            logger.info(`Component added: ${componentName} → ${outputPath}`);
        });

        // Recurse into subdirectories
        const dirs = entries.filter((e) => e.isDirectory());
        dirs.forEach((dir) => {
            ComponentLoader.traverseDirectory(
                path.join(currentPath, dir.name),
                components,
                rootDir
            );
        });
    }

    /**
     * Load per-component config.json if present, and apply defaults/extensions
     */
    static loadConfig(componentDir, componentName) {
        const configPath = path.join(componentDir, 'config.json');
        let config = null;

        if (fs.existsSync(configPath)) {
            try {
                const raw = fs.readFileSync(configPath, 'utf-8');
                config = JSON.parse(raw);
            } catch (e) {
                logger.error(`Error parsing config.json in ${componentDir}`, e);
            }
        }

        // Base modules should not extend anything
        if (['BasePage', 'BaseComponent'].includes(componentName)) {
            config = { ...(config || {}), extends: null };
        } else if (!config?.extends) {
            // Default extension for all other components
            config = { ...(config || {}), extends: 'BaseComponent' };
        }

        return config;
    }
}
