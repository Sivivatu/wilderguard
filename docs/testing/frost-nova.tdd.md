# Level 3 Frost nova: test evidence

The feature journeys and intended rules are in [the Frost nova plan](../frost-nova-plan.md).

## RED and GREEN

- `npm test -- tests/frost-nova.test.ts` first ran nine cases: eight failed because level 3 chill marks and death bursts were missing; the dead, escaped, and waiting-enemy eligibility case passed.
- `npx playwright test tests/e2e/frost-nova.spec.ts` first failed because the guide did not describe Frost nova.
- After implementation, the combat test file contains 14 cases. It covers the level 3 mark, tower and Starfall kills, chained bursts, radius edge, simultaneous kills, mark expiry, hit that kills immediately, lower levels, Deep Freeze alone, escapes, once-only kill credit, effect expiry, wave/region clearing, immutable state, and restoring saved level 3 towers.
- The focused browser test passes: a real level 3 Frost wave draws the burst, the guide explains the 90-unit effect, and there are no page errors.

## Current checks

| Check | Result | Scope |
|---|---|---|
| `npm run test:coverage` | 75 tests passed; 99.28% lines, 98.95% branches, 100% functions | Configured game, save, and artwork modules |
| `npx playwright test tests/e2e/frost-nova.spec.ts` | 1 test passed | Real combat rendering and guide text |
| `npm run test:release` | 18 tests passed | F-Droid publisher helper |
| `npm audit --audit-level=high` | No high or critical advisories; 4 existing moderate advisories | Capacitor CLI development dependencies |
| `npm run test:e2e` | 15 tests passed | Full gameplay, phone/tablet layouts, offline startup, nova rendering |
| `npm run android:beta` | Build succeeded | Beta 4, versionCode 4 |

The canvas effect is tested through the browser test, outside Vitest's configured coverage scope. Beta 4 was verified over HTTPS: all 21 payload files match the release, both signed index formats verify, all four APK hashes/signatures pass, and versionCode 4 is recommended. Physical Android installation is also not verified.
