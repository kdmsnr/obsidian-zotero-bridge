if (!items || items.length === 0) return;
const targetItem = items[0];
const title = targetItem.getField('title') || '';
let citekey = '';

try {
    if (Zotero.BetterBibTeX) {
        const keyInfo = Zotero.BetterBibTeX.KeyManager.get(targetItem.id);
        citekey = keyInfo?.citationKey || keyInfo?.citekey || '';
    }
} catch (error) {
    Zotero.log('Obsidian Bridge: CiteKey lookup failed', error);
}

if (!citekey) {
    const extra = targetItem.getField('extra') || '';
    const match = extra.match(/Citation Key:\s*(\S+)/i);
    if (match) {
        citekey = match[1];
    }
}

const vaultUrl = `obsidian://zotero-bridge?citekey=${encodeURIComponent(citekey)}&title=${encodeURIComponent(title)}`;
Zotero.launchURL(vaultUrl);
