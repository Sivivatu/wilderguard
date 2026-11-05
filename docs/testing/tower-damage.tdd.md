# Fullscreen and siege damage: test evidence

The implementation and intended behavior are recorded in [the beta 6 plan](../tower-damage-plan.md). Beta 5 remains the latest signed release; this page records beta 6 work in progress.

## RED and GREEN

- `tests/tower-combat.test.ts` first ran with 23 failures and one pass against the beta 5 engine. After implementation, all 24 cases passed: thrower timing and targeting, range and cooldowns, soldier interruption, tower damage and destruction, repairs, upgrades, escape damage, and immutable state.
- The fullscreen tests first failed because the module did not exist. `tests/fullscreen.test.ts` now passes all 12 cases, with 100% measured coverage for `src/fullscreen.ts`. It covers supported browser entry and exit, unsupported and installed hosts, rejected or ineffective requests, and preserving the compact layout.
- The save compatibility tests first failed all 14 cases because tower durability was absent. They now pass: older saves receive full health, damaged health survives checkpoints, transient effects are not saved, and malformed health values are rejected.
- Orc artwork loading first failed because there was no ranged-orc sprite. The user approved the generated Sunburst thrower concept; the fourth bundled sprite and offline loader checks now pass.
- The browser damage journey first failed because the castle had no accessible health meter. On a 740×360 landscape phone viewport, it now checks castle damage and healing, persistent tower health, confirmed paid repair, visible tower destruction feedback, and reuse of the freed build spot.
- The full browser run passed 28 of 30 tests. The remaining two exposed test issues: one expected the old fullscreen label when requesting exit, and another attempted to heal as the wave ended. After correcting those assertions and timings, both passed in a targeted run. Together, all 30 browser cases pass.

## Verification

- `npm run test:coverage`: 166 unit and integration tests passed; configured coverage is 100% lines and functions, 98.41% branches, and 99.53% statements. The configured modules include the game engine, saves, orc art, terrain, soldiers, tower combat, and fullscreen handling. Canvas rendering and DOM feedback are exercised in browser tests and are outside that coverage percentage.
- `npm run test:e2e`: 30 browser cases pass, including native/unsupported fullscreen behavior and the phone damage journeys.
- `npm run test:release`: all 18 publisher-helper tests pass.
- `npm run build` and `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/ubuntu/Android/Sdk npm run android:beta`: production and Android beta builds pass with versionCode 6.
- The earned-resource campaign test clears all 25 waves with 7 castle health and 560 diamonds. It pays for repairs and concentrates upgrades in Frostfall and the Hollow Crown; no free diamonds or enemy/reward reductions are used.
- Four existing moderate development dependency advisories remain; `npm audit` reports no high or critical advisories.

Phone screenshots show the castle-hit status and axe-thrower tower attack: [castle hit](../../artifacts/beta6-castle-hit-phone.png) and [tower destroyed](../../artifacts/beta6-axe-attack-phone.png).

The thrower artwork is recorded in `output/imagegen/orc-thrower-concept-v1.json`; the approved concept and bundled-sprite transformation are recorded in `output/imagegen/orc-thrower-concept-v1.png` and `output/imagegen/orc-thrower-bundle-v1.json`. The model used was `openai/gpt-image-2.5-sunburst` through the existing OpenCode/OpenRouter credential. No credential is stored in the artwork or provenance files.

Code and security reviews are approved with no critical or high findings. Beta 6 signing and public F-Droid publication are pending. The Samsung Tab S4 and an actual F-Droid client have not been tested.
