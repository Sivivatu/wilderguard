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
Release verification is recorded below after completion.
Physical Samsung Tab S4 and F-Droid client update checks remain unverified.

## Research and implementation scope

GitHub repository/code searches found no closer reusable engine implementation.
This uses the existing game engine and the platform's Math.random API, with no
new dependencies. The primary ECMAScript Math.random specification was retrieved
successfully on 5 November 2026. Test fixtures use deterministic success/failure
rolls and seeded mixed outcomes rather than statistical pass/fail assertions.
