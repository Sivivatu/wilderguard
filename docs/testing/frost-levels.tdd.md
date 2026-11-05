# Level-scaled Frost test evidence

## RED

Checkpoint `115057d` captures five failures among 26 focused cases against beta 7:
level 1 and level 2 chance boundaries, both live upgrades and level-specific guide
text. The other Frost priority, failed-refresh and nova cases remained covered.

## GREEN

Combat and tower details share `frostChanceForLevel`, backed by one level-to-chance
mapping: 35%, 50%, 85%. Combat reads the current tower level before each shot;
details show the matching 65%, 50%, 15% failure rates. The existing two-second
50% slow, unconditional hit damage, unchilled-target preference and level 3 nova
remain in place. No save migration or telemetry SDK was added.

All 194 unit/integration cases pass. Probability tests check zero, immediately
below the threshold, the threshold itself and nearly one at every level, with
restored deterministic random spies. Live upgrades raise the success threshold
on the next shot. Configured-module coverage is 100% lines/functions, 98.18%
branches and 99.54% statements.

The original campaign tactic narrowly loses the final wave on seed 42 with the
intended lower early-level chill rates. The revised tactic uses the existing
Deep Freeze charges on earlier visible groups instead of waiting for wave 4.
The original tower-upgrade order remains intact. All three fixed seeds (1, 7, 42)
clear all 25 waves with normal earned resources and spells. No enemy, reward,
damage, health or user-requested chance values were reduced to make it pass.

Production/offline and Android beta 8 builds pass, along with 18 publisher-helper
tests. Every web asset embedded in the unsigned APK equals the final production
build. The production audit has no advisories; four existing moderate development
advisories remain, with no high/critical advisories. Physical Samsung Tab S4 and
actual F-Droid client update testing remain unverified.

All 31 browser cases pass, including the short-phone guide and actual Frost
popover after each confirmed upgrade from level 1 through level 3. Code and
security reviews approved with no critical/high findings. Signed release
verification is recorded below. Sentry evaluation is in the separate user-requested thread.

## Signed release verification

GREEN checkpoint `b842860ed66d8565329e31036d0ef589a27be9d5` contains the verified
engine and beta 8 build inputs. The private manifest
`artifacts/beta-frost-levels-source-manifest.json` records 88 inputs, SHA-256
`c92cc760caa955598dd367cfa00b737c2c7e7d153edb64a1dc5b53471b232c49`.
All inputs remained unchanged through publication. Every web asset embedded in
the signed APK matches the final offline production build.

On 5 November 2026, distribution commit `1dab5c1ec80e2ad339e3330b485c3e431a829d69`
and tag `v0.1.0-beta.8` were published. Pages deployment `42067570304` succeeded.
Independent tag and Pages downloads matched all 25 public files and verified
both signed indexes, permanent pins and all eight APK signatures/hashes.
The live feed recommends version 8 normally. The APK is 5,172,806 bytes, SHA-256
`1d6dbe788758dce5190b557c3eb1e665a565d89993d90c1c320f699d6d11d03a`;
all seven earlier APKs remain unchanged.

Canonical signing state was promoted only after live verification, preserving
the seven-release state in `artifacts/fdroid-state-before-beta8`. Source stays
local and unpushed, with the final source/docs checkpoint tagged `v0.1.0-beta.8`.
Beta 7's tag remains unchanged. Private receipts and the verifier stay in artifacts.
