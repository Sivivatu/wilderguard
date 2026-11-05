# Level-scaled Frost chances

## Product requirement

Use 35% chill chance at level 1, 50% at level 2 and 85% at level 3.
Keep the existing preference for unchilled mobs, 50% slow for two seconds,
damage on every hit and level 3 nova. Failed chills do not refresh timers.
Show each level's chance and failure rate in the guide and tower details.

## Architecture and technical design

Replace the single probability with a shared level-to-chance mapping and helper.
Combat reads the current tower level on every shot; details use the same helper.
Existing saves already retain tower levels, so no save migration is required.
No new dependencies or artwork are needed. Keep beta 7 as the working reference.

## Tasks and verification

1. Capture RED tests at both sides of every level's chance boundary, during live
   upgrades, and in the guide/current-level summary.
2. Implement the mapping and update current gameplay documentation and beta 8
   metadata; preserve historical release notes.
3. Verify unit/integration coverage, earned-resource campaign runs, browser guide
   and battle behavior, offline production and Android builds; collect reviews.
4. Publish beta 8 using existing signing identities and independent live file,
   index and APK verification. Keep source local and earlier betas immutable.

Sentry is not installed. A separate user-requested evaluation thread holds that
work; this balance update does not enable telemetry.
