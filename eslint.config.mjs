import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accessibilité : toutes les règles recommandées de jsx-a11y (le plugin est déjà déclaré par eslint-config-next).
  {
    files: ['**/*.{jsx,tsx}'],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'docs/**',
    '.claude/**',
    'media-incoming/**',
    'test-results/**',
    'playwright-report/**',
    '.lighthouse/**',
    'ASSETS PHOTO MAQUETTE*/**',
    'MOODBOARD*/**',
    'LOGO*/**',
    'TYPO*/**',
    'bascule-satoshi.js',
  ]),
])

export default eslintConfig
