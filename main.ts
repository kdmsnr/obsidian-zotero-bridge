import { Plugin, TFile, Notice, requestUrl, parseYaml } from 'obsidian';

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
            return this.extractZoteroSelectPath(results[0]);
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
    private extractZoteroSelectPath(entry: unknown): string | null {
        if (!entry) {
            return null;
        }

        if (typeof entry === 'string') {
            return this.normalizeZoteroSelectPath(entry);
        }

        if (typeof entry === 'object') {
            const record = entry as Record<string, unknown>;
            const idValue = record['id'];
            if (typeof idValue === 'string') {
                const normalized = this.normalizeZoteroSelectPath(idValue);
                if (normalized) {
                    return normalized;
                }
            }

            const keyValue = record['key'] || record['itemKey'];
            if (typeof keyValue === 'string') {
                const groupId = this.extractNumericId(record['groupID'] ?? record['groupId']);
                if (typeof groupId === 'number') {
                    return `groups/${groupId}/items/${keyValue}`;
                }
                return `library/items/${keyValue}`;
            }
        }

        return null;
    }

    private async searchByTitle(cleanTitle: string): Promise<string | null> {
        const terms = cleanTitle.split(/\s+/).filter(Boolean);
        const normalizedTerms = terms.map(term => term.toLowerCase());
        const queries = Array.from(new Set([cleanTitle, ...terms])).filter(Boolean);

        for (const query of queries) {
            const candidates = await this.queryZoteroBBT(query);
            const match = this.findTitleMatch(candidates, normalizedTerms);
            if (match) {
                return this.extractZoteroSelectPath(match);
            }
        }

        return null;
    }

    private findTitleMatch(entries: unknown[], terms: string[]): unknown | null {
        if (entries.length === 0) {
            return null;
        }

        const effectiveTerms = terms.length > 0 ? terms : null;

        for (const entry of entries) {
            const title = this.extractTitleFromEntry(entry);
            if (!title) {
                continue;
            }

            if (!effectiveTerms) {
                return entry;
            }

            const lowerTitle = title.toLowerCase();
            const hitsAllTerms = effectiveTerms.every(term => lowerTitle.includes(term));

            if (hitsAllTerms) {
                return entry;
            }
        }

        return null;
    }

    private extractTitleFromEntry(entry: unknown): string | null {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        const record = entry as Record<string, unknown>;
        const title = record['title'];
        if (typeof title === 'string') {
            const trimmed = title.trim();
            return trimmed.length > 0 ? trimmed : null;
        }

        return null;
    }

    private normalizeZoteroSelectPath(rawId: string): string | null {
        if (!rawId) {
            return null;
        }

        const trimmed = rawId.trim();
        if (!trimmed) {
            return null;
        }

        const schemeMatch = trimmed.match(/^zotero:\/\/select\/(.+)$/i);
        if (schemeMatch) {
            return schemeMatch[1];
        }

        const urlMatch = trimmed.match(/^https?:\/\/zotero\.org\/(users|groups)\/(\d+)\/items\/([A-Za-z0-9]+)$/i);
        if (urlMatch) {
            const [, scope, scopeId, key] = urlMatch;
            const normalizedScope = scope.toLowerCase();
            if (normalizedScope === 'groups') {
                return `groups/${scopeId}/items/${key}`;
            }
            return `library/items/${key}`;
        }

        const groupsMatch = trimmed.match(/^groups\/(\d+)\/items\/([A-Za-z0-9]+)$/i);
        if (groupsMatch) {
            return `groups/${groupsMatch[1]}/items/${groupsMatch[2]}`;
        }

        const libraryMatch = trimmed.match(/^library\/items\/([A-Za-z0-9]+)$/i);
        if (libraryMatch) {
            return `library/items/${libraryMatch[1]}`;
        }

        const bareItemsMatch = trimmed.match(/^items\/(\d+)_([A-Za-z0-9]+)$/i);
        if (bareItemsMatch) {
            const [, libraryId, key] = bareItemsMatch;
            if (libraryId === '0') {
                return `library/items/${key}`;
            }
            return `groups/${libraryId}/items/${key}`;
        }

        const bareMatch = trimmed.match(/^(\d+)_([A-Za-z0-9]+)$/i);
        if (bareMatch) {
            const [, libraryId, key] = bareMatch;
            if (libraryId === '0') {
                return `library/items/${key}`;
            }
            return `groups/${libraryId}/items/${key}`;
        }

        const simpleKeyMatch = trimmed.match(/^([A-Za-z0-9]+)$/i);
        if (simpleKeyMatch) {
            return `library/items/${simpleKeyMatch[1]}`;
        }

        return null;
    }

    private extractNumericId(value: unknown): number | undefined {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }

        return undefined;
    }

    private async getNormalizedCitekeys(file: TFile): Promise<string[]> {
        const cacheCitekeys = this.collectNormalizedCitekeys(this.app.metadataCache.getFileCache(file)?.frontmatter);
        if (cacheCitekeys.length > 0) {
            return cacheCitekeys;
        }

        try {
            const content = await this.app.vault.cachedRead(file);
            const extracted = this.extractFrontmatter(content);
            return this.collectNormalizedCitekeys(extracted);
        } catch (error) {
            console.error(`Zotero Bridge: Failed to read ${file.path} for citekeys`, error);
        }

        return [];
    }

    private collectNormalizedCitekeys(frontmatter: Record<string, unknown> | undefined | null): string[] {
        if (!frontmatter) {
            return [];
        }

        const keys: string[] = [];
        for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
            const key = rawKey.trim().toLowerCase();
            if (!this.isCitekeyField(key)) {
                continue;
            }

            this.collectNormalizedValues(rawValue, keys);
        }

        return keys;
    }

    private isCitekeyField(key: string): boolean {
        return key === 'citekey'
            || key === 'cite-key'
            || key === 'zotero-key'
            || key === 'zotero_key'
            || key === 'zoterokey'
            || key === 'bbt-citekey'
            || key === 'bbt_citekey'
            || key === 'better-bibtex-citekey'
            || key === 'betterbibtexcitekey';
    }

    private collectNormalizedValues(rawValue: unknown, bucket: string[]): void {
        if (Array.isArray(rawValue)) {
            for (const entry of rawValue) {
                const normalized = this.normalizeCitekey(entry);
                if (normalized && !bucket.includes(normalized)) {
                    bucket.push(normalized);
                }
            }
            return;
        }

        const normalized = this.normalizeCitekey(rawValue);
        if (normalized && !bucket.includes(normalized)) {
            bucket.push(normalized);
        }
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

    private normalizeCitekey(raw?: unknown): string | null {
        if (typeof raw === 'number') {
            raw = String(raw);
        }

        if (typeof raw !== 'string') {
            return null;
        }

        const trimmed = raw.trim();
        if (!trimmed) {
            return null;
        }

        const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
        if (!withoutAt) {
            return null;
        }

        return withoutAt.toLowerCase();
    }

    // ==========================================
    // Logic 2: Zotero -> Obsidian
    // ==========================================
    async handleZoteroIncoming(citekey: string | undefined, title: string | undefined) {
        const files = this.app.vault.getMarkdownFiles();

        // Plan A: CiteKey
        const normalizedIncomingCitekey = this.normalizeCitekey(citekey);
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
