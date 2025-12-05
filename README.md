# Obsidian Zotero Bridge

Obsidian Zotero Bridge は、Obsidian のノートと Zotero 7（+ Better BibTeX）を相互に行き来できるようにするデスクトップ専用プラグインです。ノートの frontmatter に記載した citekey を基点に、Obsidian からは該当アイテムを Zotero で開き、逆に Zotero からは該当ノートを Obsidian で開くことができます。

## 必要環境

- Obsidian 0.15 以降（デスクトップ版）
- Zotero 7 以降
- Better BibTeX for Zotero（JSON-RPC が有効であること）
- Obsidian でカスタム URI (`obsidian://` スキーム) を開ける環境

## インストール手順

1. 依存パッケージのインストール

   ```bash
   npm install
   ```

2. ビルド

   ```bash
   npm run build
   ```

3. ビルド結果（`main.js`）と `manifest.json` を対象の Vault の `/.obsidian/plugins/obsidian-zotero-bridge/` に配置します。
4. Obsidian の設定 → Community Plugins から本プラグインを有効にします。

## 使い方

### Obsidian → Zotero

1. ノートの frontmatter に citekey を記入します。以下のいずれかのキー名、もしくは配列に対応しています。
   - `citekey`, `cite-key`
   - `zotero-key`, `zotero_key`, `zoterokey`
   - `bbt-citekey`, `bbt_citekey`
   - `better-bibtex-citekey`, `betterbibtexcitekey`
2. コマンドパレットから `Open current note in Zotero` を実行すると、Better BibTeX JSON-RPC を通じてアイテムを検索し、該当アイテムを `zotero://select/...` で開きます。
3. citekey でヒットしない場合はノート名をトークン化してタイトル検索し、最初にヒットしたアイテムを開きます。

### Zotero → Obsidian

1. Zotero の任意のアクションから `obsidian://zotero-bridge?citekey=...&title=...` を開くと、プラグインが該当ノートを検索して開きます。
2. citekey とタイトルの両方を受け付けます。citekey が一致するノートが見つからない場合はタイトルの各語を順番に含むノート名を正規表現で検索します。
3. 本リポジトリには「[Actions & Tags](https://github.com/windingwind/zotero-actions-tags)」アドオン向けのスクリプト例 `script_for_zotero-actions-tags.js` を同梱しています。アドオンのDataにスクリプトを登録し、Operationを「Script」に設定すると、選択中のアイテムの citekey とタイトルを Obsidian に送ることができます。
