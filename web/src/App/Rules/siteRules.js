const requiredAnchors = [
    'v0-spec',
    'problem',
    'architecture',
    'local-first',
    'component-library',
    'essencekit-roadmap'
];

function countMatches(html, pattern) {
    return (html.match(pattern) || []).length;
}

function getIds(html) {
    const ids = new Set();
    for (const match of html.matchAll(/\sid=["']([^"']+)["']/g)) {
        ids.add(match[1]);
    }
    return ids;
}

function getLocalLinks(html) {
    return [...html.matchAll(/<a\b[^>]*\shref=["']([^"']*)["'][^>]*>/g)]
        .map((match) => match[1])
        .filter((href) => href.startsWith('#'));
}

export default [
    {
        name: 'single-h1',
        description: 'Rendered page must contain exactly one h1.',
        check(html) {
            const h1Count = countMatches(html, /<h1\b/gi);
            if (h1Count !== 1) {
                return `Expected exactly one h1, found ${h1Count}.`;
            }
        }
    },
    {
        name: 'required-section-anchors',
        description: 'Primary CTA and navigation anchors must exist.',
        check(html) {
            const ids = getIds(html);
            const missing = requiredAnchors.filter((anchor) => !ids.has(anchor));
            if (missing.length) {
                return `Missing required anchors: ${missing.join(', ')}.`;
            }
        }
    },
    {
        name: 'local-links-resolve',
        description: 'Hash links must point to an element id in the rendered page.',
        check(html) {
            const ids = getIds(html);
            const broken = getLocalLinks(html)
                .map((href) => href.slice(1))
                .filter((target) => target && !ids.has(target));

            if (broken.length) {
                return `Broken local links: ${broken.join(', ')}.`;
            }
        }
    },
    {
        name: 'no-empty-links',
        description: 'Links must have a non-empty href.',
        check(html) {
            if (/<a\b[^>]*\shref=["']\s*["'][^>]*>/i.test(html)) {
                return 'Found an empty link href.';
            }
        }
    }
];
