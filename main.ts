import { Plugin, TFile, Notice, requestUrl, parseYaml } from 'obsidian';
import { collectNormalizedCitekeys, extractZoteroSelectPath, findTitleMatch, normalizeCitekey } from './zotero-utils';

export default class ZoteroBridgePlugin extends Plugin {

    async onload() {
        // --- 1: Obsidian -> Zotero ---
        this.addCommand({
            id: 'open-in-zotero',
            name: 'Open current note in Zotero',
            checkCallback: (checking: boolean) => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    if (!checking) {
                        this.openInZotero(file);
                    }
                    return true;
                }
                return false;
            }
        });

        // --- 2: Zotero -> Obsidian ---
        // Protocol: obsidian://zotero-bridge
        this.registerObsidianProtocolHandler("zotero-bridge", async (params) => {
            const citekey = params.citekey;
            const title = params.title;

            if (!citekey && !title) {
                new Notice("Zotero Bridge: Missing parameters. Please provide 'citekey' or 'title'.");
                return;
            }

            await this.handleZoteroIncoming(citekey, title);
        });
    }

    // ==========================================
    // Logic 1: Obsidian -> Zotero
    // ==========================================
    async openInZotero(file: TFile) {
        // 1. Get CiteKey from Frontmatter
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const citekey = frontmatter?.['citekey'] || frontmatter?.['zotero-key'];

        // Plan A: CiteKey (Existence Check)
        if (citekey) {
            const selectPath = await this.searchZoteroByBBT(citekey);

            if (selectPath) {
                window.open(`zotero://select/${selectPath}`);
                new Notice(`Opening Zotero item: @${citekey}`);
                return;
            } else {
                new Notice(`CiteKey "@${citekey}" not found in Zotero. Trying title search...`);
            }
        }

        // Plan B: Title Fallback
        const title = file.basename;
        const cleanTitle = title.replace(/[^\p{L}\p{N}]+/gu, " ");

        new Notice(`Searching Zotero for: "${cleanTitle}"...`);

        const selectPathByTitle = await this.searchByTitle(cleanTitle);

        if (selectPathByTitle) {
            window.open(`zotero://select/${selectPathByTitle}`);
            new Notice("Item found by title and opened.");
        } else {
            new Notice("No matching item found in Zotero.");
        }
    }

    // ==========================================
    // Helper: Search Zotero via BBT JSON-RPC
    // ==========================================
    async searchZoteroByBBT(query: string): Promise<string | null> {
        const results = await this.queryZoteroBBT(query);

        if (results.length > 0) {
            return extractZoteroSelectPath(results[0]);
        }

        return null;
    }

    private async queryZoteroBBT(query: string): Promise<unknown[]> {
        try {
            const response = await requestUrl({
                url: 'http://127.0.0.1:23119/better-bibtex/json-rpc',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "method": "item.search",
                    "params": [query],
                    "id": Math.floor(Math.random() * 1000)
                })
            });

            const result = response.json.result;

            if (Array.isArray(result)) {
                return result;
            }
        } catch (error) {
            console.error("Zotero Bridge Search Error:", error);
        }

        return [];
    }
    private async searchByTitle(cleanTitle: string): Promise<string | null> {
        const terms = cleanTitle.split(/\s+/).filter(Boolean);
        const normalizedTerms = terms.map(term => term.toLowerCase());
        const queries = Array.from(new Set([cleanTitle, ...terms])).filter(Boolean);

        for (const query of queries) {
            const candidates = await this.queryZoteroBBT(query);
            const match = findTitleMatch(candidates, normalizedTerms);
            if (match) {
                return extractZoteroSelectPath(match);
            }
        }

        return null;
    }

    private async getNormalizedCitekeys(file: TFile): Promise<string[]> {
        const cacheCitekeys = collectNormalizedCitekeys(this.app.metadataCache.getFileCache(file)?.frontmatter);
        if (cacheCitekeys.length > 0) {
            return cacheCitekeys;
        }

        try {
            const content = await this.app.vault.cachedRead(file);
            const extracted = this.extractFrontmatter(content);
            return collectNormalizedCitekeys(extracted);
        } catch (error) {
            console.error(`Zotero Bridge: Failed to read ${file.path} for citekeys`, error);
        }

        return [];
    }

    private extractFrontmatter(content: string): Record<string, unknown> | null {
        if (!content.startsWith('---')) {
            return null;
        }

        const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
        if (!match) {
            return null;
        }

        try {
            const parsed = parseYaml(match[1]);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        } catch (error) {
            console.error('Zotero Bridge: Failed to parse frontmatter', error);
        }

        return null;
    }

    // ==========================================
    // Logic 2: Zotero -> Obsidian
    // ==========================================
    async handleZoteroIncoming(citekey: string | undefined, title: string | undefined) {
        const files = this.app.vault.getMarkdownFiles();

        // Plan A: CiteKey
        const normalizedIncomingCitekey = normalizeCitekey(citekey);
        if (normalizedIncomingCitekey) {
            for (const file of files) {
                const citekeys = await this.getNormalizedCitekeys(file);
                if (citekeys.includes(normalizedIncomingCitekey)) {
                    await this.app.workspace.getLeaf().openFile(file);
                    new Notice(`Opened by CiteKey: ${file.basename}`);
                    return;
                }
            }
        }

        // Plan B: Fuzzy Title
        if (title) {
            const terms = title.split(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/);
            const validTerms = terms.filter(t => t.length > 0);

            if (validTerms.length > 0) {
                const regexPattern = validTerms.join(".*");
                const regex = new RegExp(regexPattern, "i");

                const hit = files.find(file => regex.test(file.basename));

                if (hit) {
                    await this.app.workspace.getLeaf().openFile(hit);
                    new Notice(`Opened by fuzzy title match: ${hit.basename}`);
                    return;
                }
            }
        }

        // Plan C: Not Found
        new Notice("Zotero Bridge: Linked note not found in Obsidian.");
    }
}
