# Regions, purchase confirmations, and soldiers: test evidence

See [the feature plan](../regions-soldiers-plan.md) for the intended behavior.

## RED and GREEN

- New geometry tests initially specified five different roads, exact projection, valid tower clearance, clamping and immutable route data; the completed geometry module passes all 7 cases.
- Soldier unit tests specify deployment/training costs, combat, once-per-tower deployment, cooldowns, survivor refunds, and immutable state. The user's selected policy refunds each survivor's share: 15 diamonds per soldier.
- The three browser purchase/soldier journeys initially failed because confirmations and garrison controls were absent. They now exercise build cancellation, Escape, confirmed spending, upgrade confirmation, pause restoration, independent training, and squad deployment.
- Campaign integration/save tests initially produced 13 failures with 57 passes before production integration. They now cover troop defaults, saved training bounds and legacy compatibility, carrying training between regions, blocking movement, shared kill/Frost nova resolution, wave settlement once, defeat clearing, and region-aware escape/targeting.
- The previous campaign script wasted spells on waiting spawns and spread final-region savings across eight low-level towers. The revised player strategy waits for five visible enemies and upgrades a four-tower final-region choke point. It clears all 25 waves with earned resources; no enemy stats or rewards were reduced for the test.

## Verification

- `npm run test:coverage`: 116 tests passed; 100% lines/functions, 98.97% branches and 99.69% statements across the configured game, save, orc artwork, geometry, soldier and terrain artwork modules.
- `npm run test:e2e`: all 20 initial browser tests passed; the added victory-refund journey also passes after the review fix, including each region’s terrain and the terrain-load error state.
- `npm run test:release`: all 18 publisher-helper tests passed.
- `npm run build`: TypeScript and offline production build pass.
- `npm run android:beta`: Android beta build passes with versionCode 5. Approved terrain B is included; signed publication checks are recorded below when complete.
- Phone checks cover 844×390, 740×360 and 667×375. Battlefield height remains at least 58% of the screen; major touch targets remain at least 44px. Status is at least 11px, wave label/count at least 12px.
- Code and security reviews found no critical/high issues. The medium review finding about a missing final-wave refund receipt was fixed and covered by a browser test that first failed on the missing receipt; the training field rejects null and values outside 1–3. Image-generation credentials stay in memory and out of provenance. Four existing moderate development CLI advisories remain, with no high/critical advisories.

UI and Canvas rendering are exercised through browser journeys and are outside the unit coverage percentage. Physical Android and F-Droid client testing remain unverified. Terrain concepts A/B were generated directly with Sunburst through OpenRouter using the user-authorized existing OpenCode key. The model/settings/prompts are recorded in `output/imagegen/terrain-concept-*-v1.json`; the user accepted style B, and five matching individual backgrounds now replace the procedural scenery. The terrain unit test first failed because its loader was absent; the browser failure test first received ready instead of error when terrain requests were blocked. Both pass after integration.
