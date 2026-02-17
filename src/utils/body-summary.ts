export interface ValueSummary {
    type: 'null' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'undefined';
    length?: number;
    keyCount?: number;
    keys?: Record<string, ValueSummary>;
    truncated?: boolean;
}

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_KEYS = 50;

const summarizeValue = (value: unknown, depth: number, maxDepth: number, maxKeys: number): ValueSummary => {
    if (value === null) {
        return {type: 'null'};
    }

    if (value === undefined) {
        return {type: 'undefined'};
    }

    if (typeof value === 'string') {
        return {
            type: 'string',
            length: value.length
        };
    }

    if (typeof value === 'number') {
        return {type: 'number'};
    }

    if (typeof value === 'boolean') {
        return {type: 'boolean'};
    }

    if (Array.isArray(value)) {
        const summary: ValueSummary = {
            type: 'array',
            length: value.length
        };

        if (depth >= maxDepth) {
            summary.truncated = true;
        }

        return summary;
    }

    if (typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        const allKeys = Object.keys(objectValue);
        const selectedKeys = allKeys.slice(0, maxKeys);
        const keysSummary: Record<string, ValueSummary> = {};

        if (depth < maxDepth) {
            for (const key of selectedKeys) {
                keysSummary[key] = summarizeValue(objectValue[key], depth + 1, maxDepth, maxKeys);
            }
        }

        return {
            type: 'object',
            keyCount: allKeys.length,
            ...(depth < maxDepth && {keys: keysSummary}),
            ...(allKeys.length > maxKeys || depth >= maxDepth ? {truncated: true} : {})
        };
    }

    return {type: 'undefined'};
};

export const summarizeRequestBody = (
    body: unknown,
    {maxDepth = DEFAULT_MAX_DEPTH, maxKeys = DEFAULT_MAX_KEYS}: {maxDepth?: number; maxKeys?: number} = {}
): ValueSummary => {
    return summarizeValue(body, 0, maxDepth, maxKeys);
};

export const getSerializedSizeBytes = (value: unknown): number | undefined => {
    try {
        return Buffer.byteLength(JSON.stringify(value));
    } catch {
        return undefined;
    }
};
