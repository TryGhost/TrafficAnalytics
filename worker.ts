import logger from './src/utils/logger.js';

function startWorker(): void {
    logger.info('Worker process started');
    
    // Log message every 10 seconds
    setInterval(() => {
        logger.info('Worker heartbeat - processing events...');
    }, 10000);

    // Handle graceful shutdown
    const gracefulShutdown = (signal: string) => {
        logger.info({signal}, 'Received shutdown signal, stopping worker');
        process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startWorker();