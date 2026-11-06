# Useful tower reach in every region

## Product requirement

Every build pad must let every level 1 tower damage fast attacking mobs during
a useful stretch of road. The circled Frostfall Pass pad is slot 8 at (485,165).
It reaches only a short corner of the current route, despite passing the old
nearest-distance check. Keep the beta 8 tag as the working reference.

## Architecture and technical design

Keep tower IDs, fixed pad coordinates and combat ranges. Adjust only affected
region road vertices so rendering, movement, combat and soldier deployment all
continue using the same geometry. Existing saves store tower IDs and levels,
so this needs no migration or progress reset. Preserve road clearance, distinct
routes and the existing path-length bounds. No artwork regeneration is needed.

## Acceptance tests and tasks

1. Capture RED coverage of all 5 regions × 8 pads × 3 level 1 tower types.
2. Define useful reach as two damage opportunities against the fastest real
   wave-5 mob, even when the tower begins a full cooldown. Include a small frame
   margin and force Frost chill to fail so slowing cannot hide a poor location.
3. Find the longest continuous section inside the real tower range, then run
   the actual engine with that mob's original health/speed and assert two hits.
4. Adjust affected roads, verify clearance and existing earned-resource campaigns,
   run coverage/browser/offline/Android checks and collect code/security reviews.
5. Publish the next immutable signed beta with independent feed/APK verification.
