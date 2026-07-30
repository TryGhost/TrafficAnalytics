import {describe, it, expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import * as shim from '../../../src/utils/gcp-logging-shim';

// The shim stands in for the `@google-cloud/logging` package index in the bundled
// build (see `resolve.alias` in vite.config.ts). Nothing else enforces that contract:
// rollup's CommonJS interop resolves a missing symbol to `undefined` rather than
// failing the build, and these tests run unbundled, so they never load the shim in
// the position it actually occupies. Read what the wrapper reaches for instead.
const require = createRequire(import.meta.url);
const WRAPPER = require.resolve('@google-cloud/pino-logging-gcp-config');

function symbolsReadFromLoggingIndex(): string[] {
    const source = readFileSync(WRAPPER, 'utf8');

    // Anchored the same way the alias is: the deep `@google-cloud/logging/build/...`
    // import still resolves to the real package, so its symbols are not our problem.
    const binding = source.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\(["']@google-cloud\/logging["']\)/);
    if (!binding) {
        throw new Error('No `require("@google-cloud/logging")` found - did the wrapper stop importing the index?');
    }

    const reads = source.matchAll(new RegExp(`\\b${binding[1]}\\.(\\w+)`, 'g'));
    return [...new Set([...reads].map(match => match[1]))].sort();
}

describe('gcp-logging-shim', () => {
    it('exports every symbol the pino wrapper reads off the logging index', () => {
        const required = symbolsReadFromLoggingIndex();

        expect(required.length).toBeGreaterThan(0);
        expect(Object.keys(shim).sort()).toEqual(expect.arrayContaining(required));
    });

    it('exposes auth for the project ID lookup the wrapper performs', () => {
        // The wrapper only ever reads `.auth` and calls `getProjectId()` on it.
        expect(typeof new shim.Logging().auth.getProjectId).toBe('function');
    });

    it('throws rather than silently mis-detecting a service context', () => {
        // Unreachable while `getLoggerConfig` passes an explicit `serviceContext`,
        // which is what selects the branch calling this.
        expect(() => shim.detectServiceContext()).toThrow(/pass serviceContext explicitly/);
    });
});
