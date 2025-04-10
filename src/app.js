// Main module file

const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World - Github Actions Deployment Test');
});

module.exports = app;
