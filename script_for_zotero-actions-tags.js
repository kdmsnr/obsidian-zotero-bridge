if (!items || items.length === 0) return;
const targetItem = items[0];
const directory = '';

const formatTitleForObsidian = (value) => {
    return value.replace(/:\s*/g, '：');
};

const zoteroTitle = targetItem.getField('title') || '';
const title = formatTitleForObsidian(zoteroTitle);
let citekey = '';

try {
    if (Zotero.BetterBibTeX) {
        const keyInfo = Zotero.BetterBibTeX.KeyManager.get(targetItem.id);
        citekey = keyInfo?.citationKey || keyInfo?.citekey || '';
    }
} catch (error) {
    Zotero.log('Obsidian Bridge: Better BibTeX citation key lookup failed', error);
}

if (!citekey) {
    const extra = targetItem.getField('extra') || '';
    const match = extra.match(/Citation Key:\s*(\S+)/i);
    if (match) {
        citekey = match[1];
    }
}

const params = [
    `citekey=${encodeURIComponent(citekey)}`,
    `title=${encodeURIComponent(title)}`
];

if (directory) {
    params.push(`dir=${encodeURIComponent(directory)}`);
}

const vaultUrl = `obsidian://zotero-bridge?${params.join('&')}`;
Zotero.launchURL(vaultUrl);
