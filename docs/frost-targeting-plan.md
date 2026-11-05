# Frost targeting and chance-based chill

## Product requirement

Frost towers prefer living enemies in range without an active tower chill. Recheck
before each shot so a newly arriving unchilled mob takes priority over chilled
mobs. If everyone in range is chilled, keep attacking in the existing order.
Archer and Cannon targeting stays the same.

## Architecture and technical design

Keep the existing 50% slow for two seconds, with an 85% chance to apply it per
direct Frost hit (15% failure). Damage always lands. A failure neither refreshes
chill nor adds/refreshes the level 3 nova mark. Successful level 3 chill and nova
death spread retain their existing behavior; spread itself is guaranteed. Deep
Freeze remains a separate guaranteed whole-wave spell and does not prevent tower
chill selection. No new save data or dependency is needed.

Filter eligible enemies once per ready shot in the existing engine, then prefer
an unchilled enemy for Frost. Use a named probability constant shared by combat
and the tower guide. Test randomness with scoped, restored spies.

## Tasks and acceptance checks

1. Record RED tests for priority, range entry, fallback, chance boundaries,
   failed refreshes and failed level 3 marks; document chances in the guide.
2. Implement the engine change and update tower descriptions and README.
3. Keep nova tests deterministic, run campaign with reproducible mixed outcomes,
   run coverage, browser guide/battle checks and production/Android builds.
4. Collect code/security reviews, preserve beta 6 and publish a signed beta 7
   using the existing separate distribution repository and signing identity.
