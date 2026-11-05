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
verification will be recorded below after completion. Sentry evaluation is in the separate user-requested thread.
