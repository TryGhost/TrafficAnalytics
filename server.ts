import './src/utils/instrumentation';

const port: number = parseInt(process.env.PORT || '3000', 10);
const listenHost: string = process.env.LISTEN_HOST || '0.0.0.0';
const isWorkerMode = process.env.WORKER_MODE === 'true';

// Load only the app this run mode needs. The production build currently inlines
// both, but importing them dynamically lets it split them into separate chunks
// once the Pub/Sub and Firestore clients are lazy too.
const app = isWorkerMode
    ? (await import('./src/worker-app')).default
    : (await import('./src/app')).default;

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
