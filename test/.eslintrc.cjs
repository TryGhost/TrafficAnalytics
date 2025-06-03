module.exports = {
    plugins: ['ghost'],
    extends: [
        'plugin:ghost/ts-test'
    ],
    rules: {
        // Using explicit any in tests is fine
        '@typescript-eslint/no-explicit-any': 'off'
    }
};
