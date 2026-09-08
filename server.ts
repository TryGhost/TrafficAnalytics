import './src/utils/instrumentation';

const port: number = parseInt(process.env.PORT || '3000', 10);
const listenHost: string = process.env.LISTEN_HOST || '0.0.0.0';
const workerMode = process.env.WORKER_MODE;

// Load only the app this run mode needs. The production build currently inlines
// all apps, but importing them dynamically lets it split them into separate chunks
// once the Pub/Sub and Firestore clients are lazy too.
async function loadApp() {
    switch (workerMode) {
    case 'true':
        return import('./src/worker-app');
    case 'automation':
        return import('./src/automation-worker-app');
    default:
        return import('./src/app');
    }
}

const app = (await loadApp()).default;

// Start the server if this file is run directly
if (import.meta.main) {
    try {
        await app.listen({host: listenHost, port});
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

// Export the app
export default app;
