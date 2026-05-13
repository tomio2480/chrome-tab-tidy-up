import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/'] },
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message: 'dangerouslySetInnerHTML is not allowed. Use Preact safe rendering instead.',
        },
      ],
    },
  },
)
