const app = require('./src/app');
const port = process.env.PORT || 3000;

const start = async () => {
    try {
        await app.listen({port});
        // eslint-disable-next-line no-console
        console.log(`Server running on port ${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
