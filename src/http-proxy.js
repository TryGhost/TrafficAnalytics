let httpProxy = require('http-proxy');
const url = require('url');

const proxy = httpProxy.createProxyServer({
    target: process.env.PROXY_TARGET || 'http://localhost:3000/local-proxy',
    ignorePath: true,
    changeOrigin: true
});

proxy.on('proxyReq', function (proxyReq, req, res, options) {
    // Parse the target URL
    const parsedUrl = url.parse(proxyReq.path, true);
    
    // Get query params from original request
    const originalQuery = url.parse(req.url, true).query;
    
    // Preserve name and token if they exist in the original request
    parsedUrl.query.name = originalQuery.name || parsedUrl.query.name || ':name';
    parsedUrl.query.token = originalQuery.token || parsedUrl.query.token || ':token';
    
    // Update the path with the new query string
    proxyReq.path = url.format(parsedUrl).replace(options.target, '');
});

proxy.on('error', (err, req, res) => {
    // eslint-disable-next-line no-console
    console.error('Proxy Error:', err);
    res.status(500).send('Proxy Error');    
});

module.exports = proxy;