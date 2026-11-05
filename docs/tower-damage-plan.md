# Beta 6: fullscreen and visible siege damage

## Product behavior

Keep beta 5's local release tag unchanged. Remove ineffective fullscreen controls in native, standalone and unsupported hosts. Supported browsers must enter and exit real fullscreen; a rejected or ineffective request reports the failure and removes the control.

Show castle health as current/20, a battlefield bar and short hit feedback. Show tower health on the battlefield and in tower details. Axe throwers first enter halfway through Greenfields wave 3, then join later waves. They throw visible axes at the nearest tower in range while marching. Soldiers engaging a thrower prevent its ranged attacks. Destroyed towers free their pads without refunding their purchase; deployed soldiers remain independent.

Towers retain damage between waves. A confirmed diamond repair restores health. Upgrades add durability while preserving existing damage. Mending Light heals the castle, not towers. Old saves restore existing towers at full health; malformed health is rejected. Retry restores the pre-wave checkpoint.

## Architecture and system design

`fullscreen.ts` owns host capability detection and fullscreen transitions. `tower-combat.ts` owns durability, repairs and immutable ranged targeting; `game.ts` orchestrates soldiers, tower fire, Frost nova, ranged attacks and escapes. Ranged enemies killed by defenses cannot retaliate. Damage effects expire and remain outside saves. The renderer draws bars, axes and hit indicators; accessible DOM messages explain damage without covering the battlefield.

`save.ts` computes maximum health from tower type and level, accepts legacy missing durability and validates new durability. No save-key/version change is needed. Artwork stays bundled and offline. Existing credentials remain outside the source repository.

## Technical checks

Use unit tests for fullscreen transitions, combat, repair costs, damage expiry, immutability and save migration. Use browser tests for unsupported/native fullscreen, supported enter/exit, castle loss/healing, tower damage/repair/destruction and short phone bounds. Run the existing 25-wave earned-resource campaign, coverage thresholds, production/Android beta builds and publisher checks. Review code and sensitive save/publication paths before release. Every signed release uses a fresh increasing version; beta 5 remains immutable.

## Task list

1. Capture failing fullscreen, combat, save and browser tests.
2. Implement the isolated fullscreen and tower-combat modules.
3. Integrate saved durability, visual health and damage feedback, repair confirmation and thrower artwork.
4. Verify phone layouts, campaign balance, offline assets and Android build; collect reviews.
5. Prepare beta 6 and verify the signed public feed without publishing source.
