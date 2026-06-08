# Obsidian Zotero Bridge

Obsidian Zotero Bridge は、Obsidian のノートと Zotero 7（+ Better BibTeX）を相互に行き来できるようにするデスクトップ専用プラグインです。ノートの frontmatter に記載した Better BibTeX の Citation Key を基点に、Obsidian からは該当アイテムを Zotero で開き、逆に Zotero からは該当ノートを Obsidian で開くことができます。

## 必要環境

- Obsidian 0.15 以降（デスクトップ版）
- Zotero 7 以降
- Better BibTeX for Zotero（JSON-RPC が有効であること）
- Obsidian でカスタム URI (`obsidian://` スキーム) を開ける環境

## 用語

- Better BibTeX の Citation Key: Better BibTeX が生成または固定する引用キーです。例: `kleppmannDesigningDataIntensiveApplications2017`。Obsidian の frontmatter に書いたり、URI の `citekey` パラメータで渡したりする値です。
- Zotero item key: Zotero 本体が持つ内部アイテム ID です。例: `PXW99EKT`。プラグインは Better BibTeX の Citation Key をこのキーに解決し、`zotero://select/...` で Zotero を開きます。

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

1. Better BibTeX の Citation Key をノートの frontmatter に記入します。Obsidian → Zotero コマンドが現在読むキー名は `citekey` または `zotero-key` です。

   ```yaml
   ---
   citekey: kleppmannDesigningDataIntensiveApplications2017
   ---
   ```
2. コマンドパレットから `Open current note in Zotero` を実行すると、Better BibTeX JSON-RPC を通じてアイテムを検索し、該当アイテムを `zotero://select/...` で開きます。
3. Better BibTeX の Citation Key でヒットしない場合はノート名をタイトルとして検索します。このとき、ノート名の `：` は Zotero タイトル検索用に `: ` に戻します。

### Zotero → Obsidian

1. Zotero の任意のアクションから `obsidian://zotero-bridge?citekey=...&title=...` を開くと、プラグインが該当ノートを検索して開きます。`citekey` パラメータには Better BibTeX の Citation Key を渡します。
2. Better BibTeX の Citation Key とタイトルの両方を受け付けます。Citation Key が一致するノートが見つからない場合は、Zotero タイトル中の `: ` を `：` に変換したノート名を優先して検索します。
3. title fallback はファイル名の表記揺れに影響されるため補助的な検索です。確実に開きたい場合は Better BibTeX の Citation Key を使ってください。
4. タイトル検索の対象ディレクトリを絞りたい場合は、Vault 相対パスで `dir` を指定します。例: `obsidian://zotero-bridge?title=...&dir=Literature%2FZotero`
   - `directory` と `folder` も `dir` の別名として使えます。
   - `dir` は Citation Key 検索には影響せず、title fallback の検索対象だけを絞ります。
5. 本リポジトリには「[Actions & Tags](https://github.com/windingwind/zotero-actions-tags)」アドオン向けのスクリプト例 `script_for_zotero-actions-tags.js` を同梱しています。アドオンのDataにスクリプトを登録し、Operationを「Script」に設定すると、選択中のアイテムの Better BibTeX の Citation Key とタイトルを Obsidian に送ることができます。title 検索の対象を絞る場合は、スクリプト内の `directory` に Vault 相対パスを指定してください。同梱スクリプトは Obsidian のファイル名運用に合わせて、Zotero タイトル中の `:` と直後の空白を `：` に変換してから `title` パラメータに渡します。
