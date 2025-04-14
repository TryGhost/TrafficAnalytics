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

// CORS middleware to allow requests from all origins
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
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
