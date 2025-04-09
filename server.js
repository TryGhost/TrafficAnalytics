const app = require('./src/app');
const port = process.env.PORT || 3000;

app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${port}`);
});
