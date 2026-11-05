# Frost targeting test evidence

## RED

Checkpoint `f12768d` adds the focused Frost targeting tests and the phone guide
assertions. Against beta 6, 12 of the 16 focused cases failed: the tower kept
shooting the first chilled mob, never rolled for chill, and the guide claimed
100% success. Fallback and non-Frost target order were already passing.

## GREEN

The engine now filters eligible mobs, prefers an unchilled mob before each Frost
shot and rolls once per direct hit for an 85% chill chance. Failed rolls retain
existing effect timers without refreshing them. Damage still lands. Successful
level 3 hits mark enemies for the existing guaranteed death spread.

All 184 unit/integration cases pass. The 16 focused cases cover newly arriving
targets, expired effects, all-chilled fallback, excluded mobs, Archer/Cannon
behavior, chance boundaries, failed refreshes, failed lethal marks, multiple
Frost towers and Deep Freeze. Scoped random spies are restored after each test.
Three reproducible mixed-success campaign runs (seeds 1, 7 and 42) clear all
25 waves using earned resources and the existing repair strategy.

Configured-module coverage is 100% lines/functions, 98.43% branches and 99.54%
statements. Production/offline and Android beta 7 builds pass; the signed-release
helper suite has 18 passing tests. All 88 source inputs match the new private
manifest, and every web asset in the unsigned APK matches the final production
build. The production audit has no advisories; four existing moderate development
advisories remain, with no high/critical advisories.

All 30 browser cases pass, including the short-phone guide's chance/preference
text, an actual level 3 nova, offline launch, siege damage and soldier refunds.
The first browser run overlapped an Android rebuild of the shared dist directory
and another test run; startup/artifact failures disappeared when the suite ran
alone against the completed build. No gameplay or fixture weakening was needed.
Code and security reviews approved with no critical/high findings. The stale
current-gameplay description in NOTES.md flagged by review was corrected.
The signed release verification is recorded below.
Physical Samsung Tab S4 and F-Droid client update checks remain unverified.

## Research and implementation scope

GitHub repository/code searches found no closer reusable engine implementation.
This uses the existing game engine and the platform's Math.random API, with no
new dependencies. The primary ECMAScript Math.random specification was retrieved
successfully on 5 November 2026. Test fixtures use deterministic success/failure
rolls and seeded mixed outcomes rather than statistical pass/fail assertions.

## Signed release verification

GREEN checkpoint `c0b8b49` contains the verified engine and beta 7 build inputs.
The private manifest `artifacts/beta-frost-targeting-source-manifest.json` records
88 inputs, SHA-256 `58981675a0c6f6c380af9f0f975502022362d1c6352b647a4937fa2924a1fc2d`.
All inputs remained unchanged through publication, and every signed APK web asset
matches the final offline production build.

On 5 November 2026, distribution commit `a8a318e8e1984084b1778ff5f12cd6a5b61271fb`
and tag `v0.1.0-beta.7` were published. Pages deployment `42023892901` succeeded.
Independent tag and Pages downloads matched all 24 payload files, both signed
indexes, permanent pins and all seven APK signatures/hashes. The live feed
recommends version 7 normally. The APK is 5,172,806 bytes, SHA-256
`0beb929a7ffcc352fa075d8ed68e404cf96b9f56a050e563307e0f576e19a901`; all six
previous APKs are unchanged.

Canonical signing state was promoted only after live verification; the previous
six-release state remains in `artifacts/fdroid-state-before-beta7`. Source stays
local and unpushed, with the final source/docs checkpoint tagged `v0.1.0-beta.7`.
Beta 6's tag remains unchanged. Private receipts and verifier remain in artifacts.
