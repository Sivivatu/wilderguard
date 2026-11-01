# Approved Sunburst orcs and wave progression — validation

The user approved concept B (`openai/gpt-image-2.5-sunburst`, generated through OpenRouter). The three transparent sprites are extracted from that exact approved board. The original source matched the published beta manifest before edits and was archived at `artifacts/reference-before-orcs-2026-11-01.tar.gz`. The distribution-only repository had no release tags; the source directory is not a Git repository, so no checkpoint commits were created.

| Requirement | Check | Evidence |
| --- | --- | --- |
| Increasing health across all waves/region boundaries | `tests/difficulty.test.ts` | Agent confirmed RED against the original 43-HP/slime implementation, then GREEN with clubbers, axes and chieftains. Ordinary HP increases from 48 to 473. |
| Harder but completable campaign | `tests/campaign.test.ts`, `tests/difficulty.test.ts` | Earned-resource mixed strategy clears all 25 waves, finishing at two lives. One static archer loses no lives in the opening wave but 19 in the final wave. |
| Load every approved sprite before allowing battle | `tests/orc-art.test.ts` | RED: missing loader module on the new seam. GREEN: both loading and rejection tests pass. |
| Actual rendering and pixel edges | `tests/e2e/orcs.spec.ts` | All three real sprite images are drawn in a live wave with smoothing disabled. Failed loading prevents wave starts. |
| Offline and touch compatibility | `tests/e2e/game.spec.ts` | Offline reload includes ready artwork; existing tablet/phone touch and checkpoint flows pass. |

Final automated checks:

- `npm run test:coverage`: 59 tests pass; game/save/art-loader line coverage 99.15%, functions 100%, branches 99.39%.
- `npm run build`: type check and production build pass; all three sprites are included in the generated offline cache.
- `npm run test:e2e`: all 8 browser tests pass. Screenshot: `artifacts/orc-battle-tablet.png`.
- `JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ANDROID_HOME=/home/ubuntu/Android/Sdk npm run android:beta`: passes, including Gradle release lint.
- `npm run test:release`: 18 existing publication-helper tests pass.
- Existing pinned publisher validates the prepared local beta 2 APK, both APK signature schemes, repository indexes, signing continuity and retention of beta 1. All source-manifest hashes match and all three sprites are inside the APK.
- Code and security reviewers found no blocking issues.
- `npm audit --omit=dev`: zero advisories. Full `npm audit`: four moderate development dependency advisories, no high/critical advisories; dependency versions were unchanged.

Local deliverable: `artifacts/Wilderguard-beta-0.1.0-beta.2.apk`, package `com.wilderguard.game.beta`, versionCode 2. APK SHA-256: `8168b78ecfecb76248ef3b4b6bfcc1c6948dc28f52b1ad44d9b7724612985d4d`. Updated source reference: `artifacts/reference-orcs-0.1.0-beta.2.tar.gz`; provenance: `artifacts/beta-orcs-source-manifest.json`.

The prepared update is not published: the live F-Droid feed still serves beta 1 and its distribution checkout is clean at `24ae071b9c8333b9372728bbd8a716496d755a45`. No physical Tab S4 test or actual F-Droid client update is claimed. Balance is proven against a deterministic strategy; Eric's play feedback is still the best check of how the harder game feels.
