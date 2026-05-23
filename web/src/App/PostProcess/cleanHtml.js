function preserveBlocks(html, pattern) {
    const blocks = [];
    const safe = html.replace(pattern, (block) => {
        const token = `__PCR_BLOCK_${blocks.length}__`;
        blocks.push(block);
        return token;
    });

    return {
        safe,
        restore(value) {
            return value.replace(/__PCR_BLOCK_(\d+)__/g, (_, index) => blocks[Number(index)]);
        }
    };
}

export default function cleanHtml(html) {
    const protectedBlocks = preserveBlocks(html, /<(pre|code|textarea)\b[^>]*>[\s\S]*?<\/\1>/gi);

    const cleaned = protectedBlocks.safe
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/>\s+</g, '><')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

    return protectedBlocks.restore(cleaned);
}
