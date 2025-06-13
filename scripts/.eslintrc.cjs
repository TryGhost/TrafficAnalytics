module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/node'
    ],
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
    },
    rules: {
        // Console statements are expected in CLI scripts
        'no-console': 'off',
        // Standard Error usage is fine in CLI scripts
        'ghost/ghost-custom/no-native-error': 'off'
    }
};