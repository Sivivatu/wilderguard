# Useful tower reach test evidence

## RED

Checkpoint `7807ebd` adds 120 cases covering five regions, eight build pads and
all three level 1 tower types. Against beta 8, five combinations at four pads
fail: Sunstone pad 7 Cannon, Frostfall pad 7 Cannon, Frostfall pad 8 Cannon and
Frost, and Hollow Crown pad 3 Cannon. The central Frostfall pad technically
reaches a corner, but gives too little firing time. The old nearest-road test
also permitted 180 units of clearance, beyond Frost's 165-unit range.

## GREEN implementation

Small road-vertex changes give these pads longer firing windows. Pad positions,
tower IDs, combat ranges, enemy stats and save formats stay the same. Rendering,
enemy movement and soldiers already share the regional road geometry.

Each combination must provide a continuous firing window long enough for two
hits on the fastest actual wave-5 mob, starting with a full tower cooldown plus
a frame margin. Tests use the real engine and the mob's original health and
speed, require two distinct damage events and check projectile type and range.
Frost's chill is forced to fail, so slow cannot conceal inadequate reach.
An escaped enemy does not count as a hit. The original enemy remains unchanged.

The geometry checks retain road clearance and length bounds, and now compare
nearest-road distance against the shortest actual base tower range. A phone
browser case observes the central Frostfall Frost tower firing in a live wave.

## Release verification

All 314 unit/integration cases pass with 100% configured line/function coverage,
98.18% branches and 99.54% statements. All three fixed campaign seeds (1, 7, 42)
clear all 25 waves with earned diamonds. The strategy places its first Hollow
Crown Archer at pad 3 instead of pad 2 to cover both nearby road sections; the
other purchases, upgrade order and spell policy remain unchanged. It finishes
with 9, 12 and 14 castle health respectively. No combat or economy values changed.

The Android beta 9 build and all 18 publisher-helper tests pass. The production
audit has no advisories; four existing moderate development advisories remain,
with none high or critical. Physical-device and F-Droid client update testing
remain unverified.

All 32 browser cases pass, including the central Frostfall tower visibly firing
at approaching mobs on a 740×360 phone viewport with failed chill rolls. Every
one of the 22 web assets embedded in the unsigned APK matches the final offline
production build. Browser checks ran after the build, using two workers after
freeing the completed Gradle daemon to avoid build-machine memory pressure.

Code and security reviews approved with no findings. The change adds no
credentials, Android permissions, external calls or telemetry.

## Signed release verification

GREEN checkpoint `7d46648c6b2258d2771c9cd90685f8d76a4d7024` contains the beta 9
build inputs. The private manifest `artifacts/beta-tower-reach-source-manifest.json`
records 88 inputs, SHA-256
`b9e7f6465c91c6d5f5e346e5430fc07fe8339d13bf20227a75bb7dddc0580c47`.
All inputs remained unchanged through publication, and all embedded signed APK
web assets match the final offline build.

On 6 November 2026, distribution commit `0fef51fdcf41d86148edc70248bfe00eeef2854d`
and tag `v0.1.0-beta.9` were published. Pages deployment `42213863904` succeeded.
Independent tag and Pages downloads matched all 26 public files and verified
both signed indexes, permanent pins and all nine APK signatures/hashes.
The feed recommends version 9 normally. The APK is 5,172,806 bytes, SHA-256
`286e4d73d783ab36565293585215977ab4a31941d241acf50cd5eae3e16662fe`.
All eight earlier APKs remain unchanged.

Canonical signing state was promoted only after live verification, preserving
the eight-release state in `artifacts/fdroid-state-before-beta9`. The source stays
local and unpushed, with the final source/docs checkpoint tagged `v0.1.0-beta.9`.
The beta 8 reference remains unchanged. Private receipts remain in artifacts.
