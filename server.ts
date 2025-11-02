import './src/utils/cjs-polyfill';
import './src/utils/instrumentation';
import {fileURLToPath} from 'url';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
const port: number = parseInt(process.env.PORT || '3000', 10);
const isWorkerMode = process.env.WORKER_MODE === 'true';

import workerApp from './src/worker-app';
import mainApp from './src/app';

// Load the appropriate app once
let app;
if (isWorkerMode) {
    app = workerApp;
} else {
    app = mainApp;
}

// Start the server if this file is run directly
if (isMainModule) {
    const start = async (): Promise<void> => {
        try {
            await app.listen({host: '::', port});
        } catch (err) {
            // Use app.log if available, otherwise fallback to console
            if (app && app.log) {
                app.log.error(err);
            } else {
                // eslint-disable-next-line no-console
                console.error(err);
            }
            process.exit(1);
        }
    };

    start();
}

// Export the app
export default app;
