import logger from './logger.js';

// Unified placeholder regex
const placeholderRegex = /@\[(.+?)\]/g;

// Caches for compiled expressions
const exprCache = new Map();

/**
 * Evaluate a JS expression string against a scope, with caching
 */
function evalExpr(expr, scope) {
    let fn = exprCache.get(expr);
    if (!fn) {
        fn = new Function('scope', `with(scope){return (${expr});}`);
        exprCache.set(expr, fn);
    }
    return fn(scope);
}

/**
 * Recursively parse nested @if/@else/@endif blocks with caching
 */
export function parseIfBlocks(html, data) {
    const openTag = '@if(';
    const elseTag = '@else';
    const closeTag = '@endif';
    let output = '';
    let index = 0;

    while (index < html.length) {
        const start = html.indexOf(openTag, index);
        if (start === -1) {
            output += html.slice(index);
            break;
        }

        output += html.slice(index, start);
        const condStart = start + openTag.length;
        const condEnd = html.indexOf(')', condStart);
        const condition = html.slice(condStart, condEnd).trim();

        let depth = 1;
        let i = condEnd + 1;
        let bodyStart = i;
        let elseIndex = -1;

        while (i < html.length && depth > 0) {
            const nextIf = html.indexOf(openTag, i);
            const nextElse = html.indexOf(elseTag, i);
            const nextEnd = html.indexOf(closeTag, i);

            if (nextIf !== -1 && nextIf < nextEnd) {
                depth++;
                i = nextIf + openTag.length;
            } else if (nextElse !== -1 && nextElse < nextEnd && depth === 1 && elseIndex === -1) {
                elseIndex = nextElse;
                i = nextElse + elseTag.length;
            } else if (nextEnd !== -1) {
                depth--;
                i = nextEnd + closeTag.length;
            } else {
                break;
            }
        }

        const trueBlock = html.slice(bodyStart, elseIndex !== -1 ? elseIndex : i - closeTag.length);
        const falseBlock = elseIndex !== -1 ? html.slice(elseIndex + elseTag.length, i - closeTag.length) : '';

        try {
            const result = evalExpr(condition, data);
            output += parseIfBlocks(result ? trueBlock : falseBlock, data);
        } catch (err) {
            logger.warn(`⚠️ Invalid condition: "${condition}"`, err.message);
        }

        index = i;
    }

    return output;
}

/**
 * Parse simple @each(item in arrayExpr)...@end blocks
 */
export function parseEachBlocks(html, data) {
    return html.replace(/@each\((\w+)\s+in\s+(.+?)\)([\s\S]*?)@end/g, (_, itemVar, arrayExpr, block) => {
        let array;
        try {
            array = evalExpr(arrayExpr, data);
        } catch (err) {
            logger.warn(`⚠️ Failed to evaluate @each(${itemVar} in ${arrayExpr}):`, err.message);
            return '';
        }
        if (!Array.isArray(array)) return '';

        return array.map(item => {
            const scope = { ...data, [itemVar]: item };
            return block.replace(placeholderRegex, (_, key) => {
                const value = key.split('.').reduce((o, k) => o?.[k], scope);
                return value != null ? value : '';
            });
        }).join('');
    });
}

/**
 * Replace all @[key] placeholders with data values or marker
 */
export function replacePlaceholders(html, data) {
    return html.replace(placeholderRegex, (_, key) => {
        const value = key.split('.').reduce((o, k) => o?.[k], data);
        return value !== undefined ? value : `[[UNRESOLVED:${key}]]`;
    });
}

/**
 * Parse all logic blocks in sequence: if, each, placeholders
 */
export function parseLogicBlocks(html, data) {
    let result = parseIfBlocks(html, data);
    result = parseEachBlocks(result, data);
    result = replacePlaceholders(result, data);
    return result;
}
