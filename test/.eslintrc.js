module.exports = {
    plugins: ['ghost', '@typescript-eslint'],
    extends: [
        'plugin:ghost/test',
        'plugin:@typescript-eslint/recommended'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    overrides: [
        {
            files: ['*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                sourceType: 'module'
            }
        }
    ]
};
