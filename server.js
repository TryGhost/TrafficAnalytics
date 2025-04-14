const app = require('./src/app');
const port = process.env.PORT || 3000;

const start = async () => {
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
