# Phone battle layout and defense details: test evidence

The journeys and implementation are described in [the phone UI plan](../phone-ui-plan.md).

## RED and GREEN

- Before implementation, `npm test -- tests/defense-stats.test.ts` ran both new tests and failed because `towerStats` and `meteorDamage` were not available. They specified the existing level scaling and region-specific Starfall damage.
- Before implementation, `npx playwright test tests/e2e/phone.spec.ts` exposed a 149px battlefield at 844×390 (target at least 58% of viewport height) and the absent touch-accessible guide. The saved-victory-action case already passed.
- After implementation, the stat tests passed. The phone tests verified large map areas at 844×390, 740×360 and 667×375; reachable controls and result actions; the tower popover; guide use during running and paused waves; region-specific Starfall details; resource preservation; and portrait overflow.
- Final full browser suite: `npm run test:e2e` — 14 tests passed. The first concurrent run overlapped Android's production build and Playwright artifact storage; it was repeated after the build and passed.
- `npm run test:coverage` — 61 tests passed. Coverage for the configured game/save/art modules was 99.18% lines (99.39% branches, 100% functions). New DOM guide coverage is measured by Playwright and is outside this configured unit coverage scope.
- `npm run test:release` — 18 tests passed. `npm run android:beta` — Android beta build succeeded with versionCode 3.

## Guarantees

| Behavior | Test | Result |
|---|---|---|
| Tower descriptions use the same damage, interval and range formulas as combat at levels 1–3 | `tests/defense-stats.test.ts` | Pass |
| Starfall detail damage follows the selected region | `tests/defense-stats.test.ts`; `tests/e2e/phone.spec.ts` | Pass |
| Frost and Deep Freeze descriptions state the actual slow amount and duration | `tests/e2e/phone.spec.ts` | Pass |
| Landscape phone layouts keep the battlefield dominant and touch controls reachable | `tests/e2e/phone.spec.ts` | Pass |
| Looking up details does not spend diamonds or spell items; help restores the earlier pause state | `tests/e2e/phone.spec.ts` | Pass |
| Existing save, combat, offline start, tablet layout, and release helpers still work | `npm run test:e2e`; `npm run test:release` | Pass |

Browser viewport emulation does not verify a physical Android phone, F-Droid installation, or update behavior. Beta 3 publication was verified independently over HTTPS: all 20 payload files matched, all three APK signatures and immutable hashes passed, both signed indexes verified, and versionCode 3 is recommended. Physical-device and F-Droid client update checks remain pending.
