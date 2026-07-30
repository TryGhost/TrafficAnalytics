import {GoogleAuth} from 'google-auth-library';

// Replaces the `@google-cloud/logging` package index in the bundle (see `resolve.alias`
// in vite.config.ts). `@google-cloud/pino-logging-gcp-config` imports the index for the
// two symbols below, which drags in google-gax, grpc-js and protobufjs — ~470 modules
// and 7.5MB — to look up a project ID. Its deep import of `.../utils/instrumentation`
// is left alone and still resolves to the real package.

// Only `.auth` is read, and only to call `getProjectId()`.
export class Logging {
    auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/logging.write']
    });
}

// Unreachable while we pass an explicit `serviceContext`, which is what selects the
// branch that would call this. Throwing keeps a silent regression from going unnoticed.
export function detectServiceContext(): never {
    throw new Error('detectServiceContext is unavailable in the bundled build - pass serviceContext explicitly');
}
