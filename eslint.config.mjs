import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * Flat config.
 *
 * `eslint-config-next` 16 exports flat config arrays directly, so there is no
 * `FlatCompat` bridge here — running these through the eslintrc compat layer
 * crashes on the React plugin's self-referential `configs` object.
 */
const eslintConfig = [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'out/**'] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    // Tests exercise deliberately hostile input; the strictness that protects
    // application code just gets in the way here.
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];

export default eslintConfig;
