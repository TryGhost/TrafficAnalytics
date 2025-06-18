import {vi} from 'vitest';
import {readFileSync} from 'fs';
import {join} from 'path';

export function mockConfigGet(overrides: Record<string, any> = {}) {
    const configPath = join(__dirname, '../../config.testing.json');
    const defaults = JSON.parse(readFileSync(configPath, 'utf8'));

    return vi.fn((key: string) => {
        return overrides[key] ?? defaults[key];
    });
}