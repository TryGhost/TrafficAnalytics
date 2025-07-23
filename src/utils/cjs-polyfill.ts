import {createRequire} from 'module';
import {fileURLToPath} from 'url';
import {dirname} from 'path';

// Create CommonJS compatibility globals for ES modules
// This is needed for some dependencies that still use CommonJS internals
/* eslint-disable no-var */
declare global {
    var require: NodeRequire;
    var __filename: string;
    var __dirname: string;
}
/* eslint-enable no-var */

// Only set these if they don't already exist
if (typeof globalThis.require === 'undefined') {
    globalThis.require = createRequire(import.meta.url);
}

if (typeof globalThis.__filename === 'undefined') {
    globalThis.__filename = fileURLToPath(import.meta.url);
}

if (typeof globalThis.__dirname === 'undefined') {
    globalThis.__dirname = dirname(globalThis.__filename);
}

export {};
