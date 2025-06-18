import app from './src/app';
import {fileURLToPath} from 'url';
import config from '@tryghost/config';

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

const port: number = parseInt(config.get('PORT'), 10);

// Start the server if this file is run directly
if (isMainModule) {
    const start = async (): Promise<void> => {
        try {
            await app.listen({host: '0.0.0.0', port});
        } catch (err) {
            app.log.error(err);
            process.exit(1);
        }
    };

    start();
}

// Export the app for Vite
export default app;
