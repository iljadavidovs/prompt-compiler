export function protectCodeBlocks(html, store = []) {
    const regex = /<(pre|code)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;

    const safe = html.replace(regex, match => {
        const index = store.push(match) - 1;
        return `%%CODEBLOCK_${index}%%`;
    });

    return { safe, store };
}

export function restoreCodeBlocks(html, blocks) {
    return html.replace(/%%CODEBLOCK_(\d+)%%/g,
        (_, i) => blocks[+i]);
}
