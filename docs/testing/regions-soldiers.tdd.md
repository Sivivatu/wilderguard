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
- `npm run android:beta`: Android beta build passes with versionCode 5. Approved terrain B is included.
- Phone checks cover 844×390, 740×360 and 667×375. Battlefield height remains at least 58% of the screen; major touch targets remain at least 44px. Status is at least 11px, wave label/count at least 12px.
- Code and security reviews found no critical/high issues. The medium review finding about a missing final-wave refund receipt was fixed and covered by a browser test that first failed on the missing receipt; the training field rejects null and values outside 1–3. Image-generation credentials stay in memory and out of provenance. Four existing moderate development CLI advisories remain, with no high/critical advisories.

UI and Canvas rendering are exercised through browser journeys and are outside the unit coverage percentage. Physical Android and F-Droid client testing remain unverified. Terrain concepts A/B were generated directly with Sunburst through OpenRouter using the user-authorized existing OpenCode key. The model/settings/prompts are recorded in `output/imagegen/terrain-concept-*-v1.json`; the user accepted style B, and five matching individual backgrounds now replace the procedural scenery. The terrain unit test first failed because its loader was absent; the browser failure test first received ready instead of error when terrain requests were blocked. Both pass after integration.

## Signed release verification

On 4 November 2026, the binary distribution commit `6c784036e7019a429d966ac8be05007ad0d8e5db` and its annotated `v0.1.0-beta.5` tag were verified on GitHub. Independent HTTPS downloads from the tag matched all 22 public files exactly. Both signed F-Droid index formats, permanent certificate pins, all five APK signatures/hashes, recommendation 5 and normal v2 release channels passed. Earlier APKs remain unchanged. The signed beta 5 APK is 5,115,371 bytes, SHA-256 `a3dfab70311d70eb8460ccb568f9c41ad417ea4d05984691ed52a135ffa50fef`.

All 84 build inputs match `artifacts/beta-regions-soldiers-source-manifest.json`, SHA-256 `9622e3936e939cc1271718d3144e43c4f57c9bbc6373a2d412c083b180a47ae8`, and the tracked inputs match local source commit `bcfa0b2` (with the known font-license newline normalization). The generated Android config is recorded in the private manifest. Every bundled web asset in the signed APK matches the final production build.

The first Pages deployment failed with HTTP 502; its retry remained stale for over seven hours during and after GitHub's service incident. The live Pages verifier correctly failed on the old release manifest. A fresh Pages build (`41875559990`) succeeded from the unchanged distribution commit on 4 November 2026. The same verifier then passed all 22 live Pages files, signed v1/v2 indexes, recommendation 5, permanent certificate pins and all five APK signatures/hashes. Verification downloads are retained in `artifacts/fdroid-beta5-live-check`; canonical signing state was promoted only after this check, preserving beta 4 state as `artifacts/fdroid-state-before-beta5`. No build inputs or signed bytes were changed during publication recovery.
