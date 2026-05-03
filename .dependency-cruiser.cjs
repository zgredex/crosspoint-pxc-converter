/**
 * dependency-cruiser config — enforces the layer chain documented in code-map.md §2:
 *   domain  ←  infra  ←  app  ←  features  ←  ui
 *
 * Wiring exception (§2): bootstrap.ts, appController.ts, and loaderRouter.ts may import
 * feature factories/types to compose the runtime graph. Other app modules cannot.
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-no-outward-imports',
      severity: 'error',
      comment: 'domain/ must be pure TS — no DOM, no store, no infra, no features, no ui.',
      from: { path: '^src/domain/' },
      to: { path: '^src/(infra|app|features|ui)/' },
    },
    {
      name: 'infra-no-app-features-ui',
      severity: 'error',
      comment: 'infra/ adapters must not know about app state, features, or ui.',
      from: { path: '^src/infra/' },
      to: { path: '^src/(app|features|ui)/' },
    },
    {
      name: 'app-no-features-ui',
      severity: 'error',
      comment:
        'app/ may not import features/ or ui/ — except the documented wiring trio ' +
        '(bootstrap.ts, appController.ts, loaderRouter.ts).',
      from: {
        path: '^src/app/',
        pathNot: '^src/app/(bootstrap|appController|loaderRouter)\\.ts$',
      },
      to: { path: '^src/(features|ui)/' },
    },
    {
      name: 'features-no-ui',
      severity: 'error',
      comment: 'features/ must not import from ui/ — bridge through deps callbacks.',
      from: { path: '^src/features/' },
      to: { path: '^src/ui/' },
    },
    {
      name: 'no-cross-feature',
      severity: 'error',
      comment: 'features/image/* and features/gb/* must not import each other.',
      from: { path: '^src/features/image/' },
      to: { path: '^src/features/gb/' },
    },
    {
      name: 'no-cross-feature-reverse',
      severity: 'error',
      comment: 'features/gb/* and features/image/* must not import each other.',
      from: { path: '^src/features/gb/' },
      to: { path: '^src/features/image/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports are forbidden.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Orphaned modules (not reachable from any entry) are likely dead code.',
      from: {
        orphan: true,
        pathNot: [
          '\\.d\\.ts$',
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.dependency-cruiser\\.cjs$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      mainFields: ['module', 'main', 'types'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
