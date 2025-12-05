import { Plugin, TFile, Notice, requestUrl } from 'obsidian';

// URLパラメータの型定義
interface ZoteroConnectParams {
    citekey?: string;
    title?: string;
}

export default class ZoteroNexusPlugin extends Plugin {

    async onload() {
        // --- 機能1: Obsidian -> Zotero ---
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

        // --- 機能2: Zotero -> Obsidian ---
        // Protocol: obsidian://zotero-nexus
        this.registerObsidianProtocolHandler("zotero-nexus", async (params) => {
            const citekey = params.citekey;
            const title = params.title;
            
            if (!citekey && !title) {
                new Notice("Zotero Nexus: Missing parameters. Please provide 'citekey' or 'title'.");
                return;
            }

            await this.handleZoteroIncoming(citekey, title);
        });
    }

    // ==========================================
    // Logic 1: Obsidian -> Zotero
    // ==========================================
    async openInZotero(file: TFile) {
        // 1. FrontmatterからCiteKeyを取得
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const citekey = frontmatter?.['citekey'] || frontmatter?.['zotero-key'];

        if (citekey) {
            // Plan A: CiteKeyがあれば直接開く
            window.open(`zotero://select/items/@${citekey}`);
            new Notice(`Opening Zotero item: @${citekey}`);
            return;
        }

        // Plan B: タイトルでBetter BibTeXに問い合わせる（フォールバック）
        const title = file.basename;
        new Notice(`CiteKey not found. Searching Zotero for: "${title}"...`);

        // 検索ヒット率を上げるためのクリーニング
        const cleanTitle = title.replace(/[:_\-\/\\|]/g, " ");

        try {
            // BBT JSON-RPC Request
            const response = await requestUrl({
                url: 'http://127.0.0.1:23119/json-rpc',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    "jsonrpc": "2.0",
                    "method": "item.search",
                    "params": [cleanTitle], 
                    "id": 1
                })
            });

            const result = response.json.result;

            if (result && result.length > 0) {
                const itemId = result[0].id || result[0]; 
                window.open(`zotero://select/items/${itemId}`);
                new Notice("Item found and opened in Zotero.");
            } else {
                new Notice("No matching item found in Zotero.");
            }

        } catch (error) {
            console.error("Zotero Nexus Error:", error);
            new Notice("Failed to connect to Zotero. Ensure Zotero is running with Better BibTeX.");
        }
    }

    // ==========================================
    // Logic 2: Zotero -> Obsidian
    // ==========================================
    async handleZoteroIncoming(citekey: string | undefined, title: string | undefined) {
        const files = this.app.vault.getMarkdownFiles();

        // -----------------------------------
        // Step 1: CiteKeyで検索 (Plan A)
        // -----------------------------------
        if (citekey) {
            const hit = files.find(file => {
                const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
                return fm && (fm['citekey'] === citekey || fm['zotero-key'] === citekey);
            });

            if (hit) {
                await this.app.workspace.getLeaf().openFile(hit);
                new Notice(`Opened by CiteKey: ${hit.basename}`);
                return;
            }
        }

        // -----------------------------------
        // Step 2: タイトルであいまい検索 (Plan B)
        // -----------------------------------
        if (title) {
            // 記号以外で単語分割して正規表現作成
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

        // -----------------------------------
        // Step 3: 新規作成 (Plan C)
        // -----------------------------------
        const baseName = title || citekey || "Untitled Zotero Note";
        const newFileName = this.sanitizeFileName(baseName);
        
        new Notice("Note not found. Creating new note...");
        
        // 重複回避 (e.g., Note (1).md)
        let finalName = newFileName;
        let counter = 1;
        while (await this.app.vault.adapter.exists(`${finalName}.md`)) {
            finalName = `${newFileName} (${counter})`;
            counter++;
        }

        // テンプレート内容
        const content = `---
citekey: ${citekey || ""}
title: ${title || ""}
created: ${new Date().toISOString()}
---

# ${title || "No Title"}

`;
        
        const newFile = await this.app.vault.create(`${finalName}.md`, content);
        await this.app.workspace.getLeaf().openFile(newFile);
    }

    // ファイル名サニタイズ
    sanitizeFileName(name: string): string {
        // Windows/Mac/Linuxで禁止されている文字をハイフン等に置換
        return name.replace(/[:\/\\|?*<>"]/g, " - ");
    }
}