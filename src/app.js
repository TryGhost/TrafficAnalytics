// Main module file
const express = require('express');
const httpProxy = require('./http-proxy');

const app = express();

// Request logging middleware
app.use((req, res, next) => {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode}`);
    next();
});

app.get('/', (req, res) => {
    res.status(200).send('Hello World - Github Actions Deployment Test');
});

app.post('/tb/web_analytics', (req, res) => {
    httpProxy.web(req, res);
});

app.get('/local-proxy*', (req, res) => {
    res.status(200).send('Hello World - From the local proxy');
});

module.exports = app;
