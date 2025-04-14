module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/node'
    ],
    rules: {
        'eol-last': ['error', 'always'],
        'no-trailing-spaces': 'error'
    }
};
