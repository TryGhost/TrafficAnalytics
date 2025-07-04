import './src/utils/instrumentation';
import {fileURLToPath} from 'url';
import {initializeApp} from './src/initializeApp';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
const port: number = parseInt(process.env.PORT || '3000', 10);
const isWorkerMode = process.env.WORKER_MODE === 'true';

// Create an instance of the appropriate app
const app = await initializeApp({isWorkerMode});

// Start the server if this file is run directly
if (isMainModule) {
    const start = async (): Promise<void> => {
        try {
            await app.listen({host: '0.0.0.0', port});
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

export default app;