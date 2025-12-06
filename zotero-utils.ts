const citekeyFields = new Set([
    'citekey',
    'cite-key',
    'zotero-key',
    'zotero_key',
    'zoterokey',
    'bbt-citekey',
    'bbt_citekey',
    'better-bibtex-citekey',
    'betterbibtexcitekey'
]);

export type Frontmatter = Record<string, unknown> | null | undefined;

export function normalizeZoteroSelectPath(rawId: string): string | null {
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

export function extractZoteroSelectPath(entry: unknown): string | null {
    if (!entry) {
        return null;
    }

    if (typeof entry === 'string') {
        return normalizeZoteroSelectPath(entry);
    }

    if (typeof entry === 'object') {
        const record = entry as Record<string, unknown>;
        const idValue = record['id'];
        if (typeof idValue === 'string') {
            const normalized = normalizeZoteroSelectPath(idValue);
            if (normalized) {
                return normalized;
            }
        }

        const keyValue = record['key'] || record['itemKey'];
        if (typeof keyValue === 'string') {
            const groupId = extractNumericId(record['groupID'] ?? record['groupId']);
            if (typeof groupId === 'number') {
                return `groups/${groupId}/items/${keyValue}`;
            }
            return `library/items/${keyValue}`;
        }
    }

    return null;
}

function extractNumericId(value: unknown): number | undefined {
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

export function findTitleMatch(entries: unknown[], terms: string[]): unknown | null {
    if (entries.length === 0) {
        return null;
    }

    const effectiveTerms = terms.length > 0 ? terms : null;

    for (const entry of entries) {
        const title = extractTitleFromEntry(entry);
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

function extractTitleFromEntry(entry: unknown): string | null {
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

export function collectNormalizedCitekeys(frontmatter: Frontmatter): string[] {
    if (!frontmatter) {
        return [];
    }

    const keys: string[] = [];
    for (const [rawKey, rawValue] of Object.entries(frontmatter)) {
        const key = rawKey.trim().toLowerCase();
        if (!isCitekeyField(key)) {
            continue;
        }

        collectNormalizedValues(rawValue, keys);
    }

    return keys;
}

function collectNormalizedValues(rawValue: unknown, bucket: string[]): void {
    if (Array.isArray(rawValue)) {
        for (const entry of rawValue) {
            const normalized = normalizeCitekey(entry);
            if (normalized && !bucket.includes(normalized)) {
                bucket.push(normalized);
            }
        }
        return;
    }

    const normalized = normalizeCitekey(rawValue);
    if (normalized && !bucket.includes(normalized)) {
        bucket.push(normalized);
    }
}

function isCitekeyField(key: string): boolean {
    return citekeyFields.has(key);
}

export function normalizeCitekey(raw?: unknown): string | null {
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
