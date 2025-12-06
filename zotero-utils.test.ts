import { describe, expect, it } from 'vitest';
import { collectNormalizedCitekeys, extractZoteroSelectPath, findTitleMatch, normalizeCitekey, normalizeZoteroSelectPath } from './zotero-utils';

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
