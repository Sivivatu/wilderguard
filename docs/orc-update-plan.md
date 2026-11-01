# Wilderguard: approved orcs and stronger waves

## Product requirement

Eric chose [Sunburst concept B](../output/imagegen/orc-compare-sunburst-v1.png). Replace the slime-like enemies with its club orc, axe orc, and armored captain. Preserve its visible square pixels and textured, realistic materials when enemies appear on the Tab S4 battlefield. Make enemies more dangerous as each five-wave region progresses and as the campaign moves to the next region. Keep the opening wave approachable and all 25 waves winnable with earned towers, diamonds, and spells. Preserve the credit: “Made by Eric, a 7-year-old boy.”

## Current behavior and reference

`src/game.ts` uses five regions with five waves each. Wave count is `4 + wave + regionIndex * 2`; regular health is `(32 + wave * 11) * (1 + regionIndex * .6)`. Regular speed increases by only two per wave. The last enemy in wave five is a three-health-multiplier brute. Regular enemies are currently identified as `slime` or `goblin`, and `src/render.ts` draws them as small Canvas shapes. `tests/campaign.test.ts` checks that all regions can be cleared with earned resources, but it does not assert that later waves put pressure on the player. Save files contain towers and campaign progress, not active enemies, so enemy kind changes need not alter the save format.

The published `0.1.0-beta.1` distribution has no release tag; its distribution repository is at `24ae071b9c8333b9372728bbd8a716496d755a45`. The source matched `artifacts/beta-source-manifest.json` before this change. A local baseline archive is at `artifacts/reference-before-orcs-2026-11-01.tar.gz` (SHA-256 `a3b04229a7ed4fcf0010b55a0e7bee20abecda144ae8599550b3a8a384da4dfe`).

## Architecture and technical choices

- Extract three transparent PNG sprites from approved concept B, retaining its club, axe, and captain designs. Source them from `public/` so Vite, Capacitor, and the service worker can bundle them offline. Review the cutouts at the actual on-map size: thin weapons and tusks must remain legible against all five biomes. Use nearest-neighbor sampling for the sprites. Keep enemy hit points and sorting in the game state; art loading and drawing belong in `src/render.ts`.
- Rename the gameplay enemy kinds to match the visual roles: club orc, axe orc, captain. Ensure wave composition introduces axe orcs and culminates in a captain. Use one focused wave-scaling rule in `src/game.ts` for health, speed, count, and spacing rather than scattered special cases. Keep captain escape damage distinct. Evaluate the difficulty using actual tower DPS, spells, path length, and rewards; a numeric health increase alone is insufficient evidence of better play.
- Update region descriptions, README, and NOTES to describe the new enemies and pixel artwork. Retain Eric’s credit verbatim. Avoid unnecessary save-schema changes and preserve existing installation and reward rules.

## Ordered tasks and verification

1. Add behavior tests in `tests/game.test.ts` for increasing health, speed, and enemy mix across waves and regions, including captain escape damage. Confirm a meaningful new test fails against current behavior before changing `src/game.ts`.
2. Tune `startWave`, then run the focused tests. Keep the first wave playable with the starting 120 diamonds; later waves should require sensible tower purchases or spell timing.
3. Extract and inspect the approved sprites, then replace procedural enemy rendering. Check the three types in a real browser at map scale and inspect contrasting backgrounds. Confirm no slime shapes or labels remain in the running game.
4. Run `tests/campaign.test.ts` with earned resources. Add a deterministic pressure check that late waves cost lives or otherwise strain a simple defense, while the full five-region campaign still finishes. Adjust numbers based on this evidence, not appearance alone.
5. Run `npm test`, `npm run test:coverage`, `npm run build`, and `npm run test:e2e`. Verify offline sprite loading and the landscape tablet layout. Build and inspect the Android beta if the local Java/SDK toolchain is available. Review code and security before completion.

The user approved the visual concept, not a new public release. Keep the existing published APK unchanged until the updated build has been reviewed and any publication step is explicitly requested.
