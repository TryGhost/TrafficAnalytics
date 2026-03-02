module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/ts'
    ],
    rules: {
        'no-restricted-syntax': [
            'error',
            {
                selector: 'CallExpression[callee.object.name=\'logger\'] > ObjectExpression > Property[key.name=\'error\']',
                message: 'Use `err` instead of `error` — Pino only serializes errors on the `err` key.'
            }
        ]
    }
};
