import app from './src/app';

const port: number = parseInt(process.env.PORT || '3000', 10);

// Start the server if this file is run directly
if (process.env.NODE_ENV !== 'production' && require.main === module) {
    const start = async (): Promise<void> => {
        try {
            await app.listen({host: '0.0.0.0', port});
            // eslint-disable-next-line no-console
            console.log(`Server running on port ${port}`);
        } catch (err) {
            app.log.error(err);
            process.exit(1);
        }
    };

    start();
}

// Export the app for Vite
export default app;
