import {describe, it, expect} from 'vitest';
import {getSerializedSizeBytes, summarizeRequestBody} from '../../../src/utils/body-summary';

describe('body-summary utils', () => {
    it('should summarize object keys with value type and length metadata', () => {
        const summary = summarizeRequestBody({
            name: 'ghost',
            count: 3,
            active: true,
            tags: ['a', 'b'],
            metadata: {
                nested: 'value'
            }
        });

        expect(summary).toEqual({
            type: 'object',
            keyCount: 5,
            keys: {
                name: {
                    type: 'string',
                    length: 5
                },
                count: {
                    type: 'number'
                },
                active: {
                    type: 'boolean'
                },
                tags: {
                    type: 'array',
                    length: 2
                },
                metadata: {
                    type: 'object',
                    keyCount: 1,
                    keys: {
                        nested: {
                            type: 'string',
                            length: 5
                        }
                    }
                }
            }
        });
    });

    it('should include truncation metadata when depth is exceeded', () => {
        const summary = summarizeRequestBody({
            level1: {
                level2: {
                    level3: 'x'
                }
            }
        }, {maxDepth: 1});

        expect(summary).toEqual({
            type: 'object',
            keyCount: 1,
            keys: {
                level1: {
                    type: 'object',
                    keyCount: 1,
                    truncated: true
                }
            }
        });
    });

    it('should return serialized size for JSON-serializable values', () => {
        const size = getSerializedSizeBytes({value: 'abc'});
        expect(size).toBe(15);
    });
});
