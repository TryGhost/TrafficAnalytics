module.exports = {
    plugins: ['ghost', '@typescript-eslint'],
    extends: [
        'plugin:ghost/ts',
        'plugin:@typescript-eslint/recommended'
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        tsconfigRootDir: __dirname
    },
    rules: {
        'eol-last': ['error', 'always'],
        'no-trailing-spaces': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['error', {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }]
    },
    overrides: [
        {
            files: ['*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                sourceType: 'module'
            }
        },
        {
            // For .eslintrc.js and other config files
            files: ['.eslintrc.js', '*.config.js'],
            env: {
                node: true
            }
        },
        {
            // For test files
            files: ['test/**/*.ts'],
            rules: {
                '@typescript-eslint/no-unused-vars': 'off',
                '@typescript-eslint/no-explicit-any': 'off'
            }
        }
    ]
};
