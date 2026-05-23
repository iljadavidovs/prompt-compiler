import fs from 'fs';
import path from 'path';

/**
 * Dynamically loads a module.
 * @param {string} modulePath - The module path relative to the core folder (e.g., "Compiler/Renderer.js").
 * @param {string} appRoot - Absolute path to the App directory.
 * @param {string} coreRoot - Absolute path to the core package.
 */
export default async function loadModule(modulePath, appRoot, coreRoot) {
    // Construct the potential override path, e.g., App/Compiler/Renderer.js
    const overridePath = path.resolve(appRoot, modulePath);
    if (fs.existsSync(overridePath)) {
        return (await import(overridePath)).default;
    }
    // Otherwise, fallback to the default core implementation
    return (await import(path.resolve(coreRoot, modulePath))).default;
}