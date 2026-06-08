import { describe, expect, it } from 'vitest';
import {
    collectNormalizedCitekeys,
    extractZoteroSelectPath,
    findFuzzyTitleFile,
    findTitleMatch,
    isFileInDirectory,
    normalizeCitekey,
    normalizeDirectoryFilter,
    normalizeZoteroSelectPath,
    titleToObsidianTitle,
    titleToZoteroTitle
} from './zotero-utils';

describe('normalizeZoteroSelectPath', () => {
    it('normalizes zotero select URIs', () => {
        expect(normalizeZoteroSelectPath('zotero://select/library/items/ABCDE')).toBe('library/items/ABCDE');
    });

    it('normalizes Zotero web URLs', () => {
        expect(normalizeZoteroSelectPath('https://zotero.org/groups/25/items/XYZ123')).toBe('groups/25/items/XYZ123');
        expect(normalizeZoteroSelectPath('https://zotero.org/users/0/items/Z9999')).toBe('library/items/Z9999');
    });

    it('normalizes bare identifiers', () => {
        expect(normalizeZoteroSelectPath('groups/4/items/ABCD')).toBe('groups/4/items/ABCD');
        expect(normalizeZoteroSelectPath('items/0_FGHJK')).toBe('library/items/FGHJK');
        expect(normalizeZoteroSelectPath('0_FGHJK')).toBe('library/items/FGHJK');
        expect(normalizeZoteroSelectPath('  LMNOP  ')).toBe('library/items/LMNOP');
    });

    it('returns null for invalid identifiers', () => {
        expect(normalizeZoteroSelectPath('')).toBeNull();
        expect(normalizeZoteroSelectPath('   ')).toBeNull();
        expect(normalizeZoteroSelectPath('not-a-match')).toBeNull();
    });
});

describe('extractZoteroSelectPath', () => {
    it('works with string entries', () => {
        expect(extractZoteroSelectPath('zotero://select/groups/1/items/AAAA')).toBe('groups/1/items/AAAA');
    });

    it('works with object entries that expose id or key fields', () => {
        expect(extractZoteroSelectPath({ id: 'library/items/BBBB' })).toBe('library/items/BBBB');
        expect(extractZoteroSelectPath({ itemKey: 'DIFFERENT', groupID: 7 })).toBe('groups/7/items/DIFFERENT');
        expect(extractZoteroSelectPath({ key: 'CCC333' })).toBe('library/items/CCC333');
        expect(extractZoteroSelectPath({ key: 'DDD444', groupId: '9' })).toBe('groups/9/items/DDD444');
    });

    it('returns null when no usable identifiers exist', () => {
        expect(extractZoteroSelectPath({ id: '' })).toBeNull();
        expect(extractZoteroSelectPath({ title: 'no id fields' })).toBeNull();
        expect(extractZoteroSelectPath(null)).toBeNull();
    });
});

describe('normalizeCitekey', () => {
    it('strips whitespace and leading @ then lowercases', () => {
        expect(normalizeCitekey('  @Smith2020 ')).toBe('smith2020');
        expect(normalizeCitekey('DOE2021')).toBe('doe2021');
    });

    it('handles numeric citekeys and invalid values', () => {
        expect(normalizeCitekey(1234)).toBe('1234');
        expect(normalizeCitekey('@')).toBeNull();
        expect(normalizeCitekey('')).toBeNull();
        expect(normalizeCitekey(undefined)).toBeNull();
    });
});

describe('collectNormalizedCitekeys', () => {
    it('collects citekeys from all supported field aliases', () => {
        const frontmatter = {
            citekey: '@Alpha2020',
            'zotero-key': ['Bravo2021', ''],
            Title: 'Ignored',
            'bbt_citekey': ['@Alpha2020', '@Charlie2022']
        };

        expect(collectNormalizedCitekeys(frontmatter)).toEqual(['alpha2020', 'bravo2021', 'charlie2022']);
    });

    it('deduplicates citekeys across arrays and values', () => {
        const frontmatter = {
            citekey: ['@DupKey', '@DupKey'],
            'better-bibtex-citekey': '@Unique'
        };

        expect(collectNormalizedCitekeys(frontmatter)).toEqual(['dupkey', 'unique']);
    });

    it('returns empty array when no frontmatter provided', () => {
        expect(collectNormalizedCitekeys(undefined)).toEqual([]);
        expect(collectNormalizedCitekeys(null)).toEqual([]);
    });
});

describe('findTitleMatch', () => {
    const entries = [
        { title: ' First Paper ' },
        { title: 'Second interesting Result' },
        { title: 'Computation and Biology' }
    ];

    it('returns first entry when no search terms are provided', () => {
        expect(findTitleMatch(entries, [])).toEqual(entries[0]);
    });

    it('matches entries containing all normalized terms', () => {
        expect(findTitleMatch(entries, ['second', 'result'])).toEqual(entries[1]);
    });

    it('returns null when entries lack the terms or titles', () => {
        expect(findTitleMatch(entries, ['missing'])).toBeNull();
        expect(findTitleMatch([{ title: '' }, {}], ['any'])).toBeNull();
    });
});

describe('title colon conversion', () => {
    it('formats Zotero titles for Obsidian filenames', () => {
        expect(titleToObsidianTitle('Domain-Driven Design: Tackling Complexity')).toBe('Domain-Driven Design：Tackling Complexity');
        expect(titleToObsidianTitle('A:B')).toBe('A：B');
    });

    it('restores Obsidian filenames for Zotero title search', () => {
        expect(titleToZoteroTitle('Domain-Driven Design：Tackling Complexity')).toBe('Domain-Driven Design: Tackling Complexity');
        expect(titleToZoteroTitle('A：B')).toBe('A: B');
    });
});

describe('normalizeDirectoryFilter', () => {
    it('normalizes vault-relative directories', () => {
        expect(normalizeDirectoryFilter(' Literature/Zotero/ ')).toBe('Literature/Zotero');
        expect(normalizeDirectoryFilter('/Literature/Zotero/')).toBe('Literature/Zotero');
        expect(normalizeDirectoryFilter('./Literature/Zotero')).toBe('Literature/Zotero');
    });

    it('returns null for root, empty, and non-string values', () => {
        expect(normalizeDirectoryFilter('/')).toBeNull();
        expect(normalizeDirectoryFilter('')).toBeNull();
        expect(normalizeDirectoryFilter(undefined)).toBeNull();
    });
});

describe('isFileInDirectory', () => {
    it('matches files recursively under the directory', () => {
        expect(isFileInDirectory('Literature/Zotero/Paper.md', 'Literature')).toBe(true);
        expect(isFileInDirectory('Literature/Zotero/Paper.md', 'Literature/Zotero')).toBe(true);
    });

    it('does not match sibling files with the same prefix', () => {
        expect(isFileInDirectory('Literature Notes/Paper.md', 'Literature')).toBe(false);
        expect(isFileInDirectory('Literature.md', 'Literature')).toBe(false);
    });

    it('matches all files when no directory is provided', () => {
        expect(isFileInDirectory('Any/Folder/Paper.md')).toBe(true);
    });
});

describe('findFuzzyTitleFile', () => {
    const files = [
        { basename: 'Important Paper', path: 'Inbox/Important Paper.md' },
        { basename: 'Important Paper', path: 'Literature/Important Paper.md' },
        { basename: 'Domain-Driven Design：Tackling Complexity', path: 'Literature/Domain-Driven Design：Tackling Complexity.md' },
        { basename: 'C++ Patterns (2024)', path: 'Literature/C++ Patterns (2024).md' }
    ];

    it('finds a fuzzy title match within the selected directory', () => {
        expect(findFuzzyTitleFile(files, 'Important Paper', 'Literature')).toEqual(files[1]);
    });

    it('finds the full-width colon title variant before fuzzy fallback', () => {
        expect(findFuzzyTitleFile(files, 'Domain-Driven Design: Tackling Complexity', 'Literature')).toEqual(files[2]);
    });

    it('escapes regex characters in title terms', () => {
        expect(findFuzzyTitleFile(files, 'C++ Patterns (2024)', 'Literature')).toEqual(files[3]);
    });

    it('returns null when title terms only match outside the directory', () => {
        expect(findFuzzyTitleFile(files, 'Important Paper', 'Archive')).toBeNull();
    });
});
