# Wilderguard — project notes

**Made by Eric, a 7-year-old boy.**

## The idea

Eric’s idea: a country is under attack by monsters. Each protected wave earns diamonds or a special item. Every few waves, you travel to another part of the country to free it from stronger monsters.

Wilderguard tells that story across five places in Elderglen: The Greenfields, Whispering Woods, Sunstone Ridge, Frostfall Pass, and The Hollow Crown. Free five waves at each place. As monsters get stronger, you bring your diamonds and items onward and rebuild your defenses. Free a region and receive 180 extra diamonds, plus 60 for each region you have already freed.

## What’s in the game

- Archer, Cannon, and Frost towers. Upgrade them to level 3 or sell them for a 60% refund.
- Eric chose the Sunburst pixel-art orc concept. Club wielders lead the opening wave; axe orcs arrive from wave 2, and each region’s last wave has an armored chieftain.
- Ordinary orcs gain about 10% health per wave across the campaign. Axe orcs have 1.5 times ordinary health; each region’s chieftain has three times ordinary health and costs three lives if it reaches the castle.
- Diamond rewards after every wave. Earn Deep Freeze at wave 3 and Starfall at wave 5; use Mending Light to restore health.
- Pause, 2× speed, fullscreen, touch-friendly controls, and a special battle view in the Android app and installed browser app.
- The compact phone battle view keeps the map large in landscape. Tower and spell cards stay easy to tap, and **Tower & spell guide** opens the strengths and exact values without spending an item or diamonds.
- Archer: 15 damage every 0.7 seconds, range 185. Cannon: 35 damage every 1.65 seconds, range 170, with splash damage at less than 65 path units. Frost: 8 damage every 0.8 seconds, range 165; every hit slows its target by 50% for two seconds. Tower upgrades show their current damage, interval, and range.
- Deep Freeze slows the full wave by 88% for six seconds. Starfall damages every visible enemy for 110 in Greenfields, adding 25% of its base damage per region. Mending Light restores six health, up to 20.
- Level 3 Frost towers unlock Frost nova in beta 4. A mob killed during the tower's two-second chill triggers a 90-unit area burst that spreads the same 50% slow for two seconds. Any tower or Starfall kill can trigger it, and newly chilled mobs can spread it again while their chill lasts. The burst adds no damage; lower Frost levels and Deep Freeze alone do not trigger it.
- Confirmations for tower construction, tower upgrades, troop deployment and training; clearer wave/status text on phones.
- Five distinct region roads used by enemy movement, tower targeting, Frost nova and soldiers.
- Two-soldier squads cost 30 diamonds per tower per wave. Each surviving soldier refunds 15 after a successful wave. Campaign training upgrades cost 35/70 diamonds and improve future squads independently of tower upgrades.
- A local checkpoint between waves so a retry restores the last saved setup.
- An offline browser build, an original Android debug preview, and a separate unlisted F-Droid beta built with Capacitor 6.
- Five locally bundled Sunburst pixel-photo terrain backgrounds in approved style B, distinct Canvas roads, pixel-art orc sprites, and bundled fonts with their license files.

The unlisted beta is distributed through a public developer-operated feed rather than F-Droid’s official catalog. Anyone with its link can access the public APK and repository files; the link provides no access control or privacy. The separate beta app does not import progress from the original debug preview. There are no game accounts, game servers, tracking, advertising, or in-app purchases. Save data stays on the device. A small post-install script checks and patches a known Capacitor 6 and `tar` 7 compatibility issue. Run `npm audit` before a release and review any new development-tool advisories.

## Before sharing the game

This is a first playable version, not a finished store release. Eric should try it on his actual Tab S4. Check landscape display, touches, offline start, and whether the battles feel fair; adjust the waves with him and finish any art, sounds, tutorial text, or polish he wants. The current gentle sounds are made in code. Neither the original preview nor the beta has been tested on a physical Tab S4. The interrupted emulator run did not establish F-Droid installation. The public page and signed feed have been verified as described below.

## Beta publication — 31 October 2026

The original signed beta `0.1.0-beta.1` was published at https://sivivatu.github.io/wilderguard-beta/ with a custom F-Droid repository, QR code, and direct APK download. Public HTTPS, signed v1/v2 indexes, APK hashes, and the permanent signing identity were independently checked. This is outside the official F-Droid catalog, but the page and its files are publicly accessible. The beta installs alongside the original preview with separate saves. Physical Tab S4 and F-Droid client installation/update checks remain pending. Beta 1 is retained as the original published build.

## Beta 2 publication — 1 November 2026

Beta `0.1.0-beta.2` (versionCode 2) is published in the same F-Droid feed and recommended for updates. Its signed APK is available at https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_2.apk. The publication corrects the metadata's previous beta 1 recommendation, so beta 2 is offered as the normal current version rather than only as a beta-channel alternative. Both published APKs and the permanent signing identities are retained.

Automated verification passes: 59 unit tests with 99.15% line coverage, all 8 browser tests, the Android beta build, and 18 release-helper tests. Public HTTPS downloads, APK hashes, both signed index formats, and signing continuity are verified. Physical Tab S4 testing and an actual F-Droid client update remain pending. The source repository stays local; only the separate distribution checkout was pushed.

The local source snapshot matching the published beta’s source manifest is preserved at `artifacts/reference-before-orcs-2026-11-01.tar.gz`. The distribution repository had no release tags when checked before these changes. Orc source art, hashes, generation details, and local license status are recorded in [`src/assets/README.md`](src/assets/README.md).

## Local Git repository — 1 November 2026

The project now has a local source repository on `main`, with the beta 2 source checkpoint tagged `v0.1.0-beta.2`. No remote or push is configured. The source, Android project, tests, docs, and artwork are tracked; generated artifacts and credentials remain local and ignored. The F-Droid distribution repository inside `artifacts/` is preserved separately.

## Phone interface — beta 3 publication

At 844×390 in battle focus, the battlefield grew from 149px to 248px high (about 38% to 64% of the screen), while the tower, spell, help, and wave controls retain 44px touch targets. Victory actions remain inside the map. Opening the guide pauses an active wave and restores its previous pause state when closed. Combat balance did not change; the guide uses the same tower stat and spell damage calculations as combat.

Beta `0.1.0-beta.3` (versionCode 3) is published and recommended in both signed feed formats. The browser APK is https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_3.apk. Independent HTTPS downloads matched all 20 public payload files; APK v1/v2 signatures, permanent certificate pins, all three immutable release hashes, and the latest recommendation were verified. APK SHA-256: `c2206dcf7d206aaab70715212b5afd3fea7268e366bb88d079f2d5d7157eecde`. The public distribution commit is `e2e4c5c00d279f69b9ffd48a3a6dc28eaf77c6c7`; the source remains local and is tagged `v0.1.0-beta.3`.

Validation for beta 3: 61 unit tests; 99.18% line coverage for the existing instrumented game, save, and artwork modules; all 14 browser tests; 18 release-helper tests; and a successful Android beta build. UI guide coverage is provided by browser tests and is not included in the unit coverage percentage. Physical Android and F-Droid client installation remain unverified.

## Level 3 Frost nova — beta 4 publication

The current source adds contagious Frost slow to level 3: any visible enemy killed while the mark is active triggers an icy burst within 90 battlefield units. Living, visible enemies in range receive the same 50% slow and two-second mark, so a later kill can chain another burst. The burst adds no damage. Level 1 or 2 Frost and Deep Freeze alone do not mark mobs. Effects fade between waves and are not added to the campaign save format.

Beta `0.1.0-beta.4` (versionCode 4) is published and recommended in both signed feed formats. Download it at https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_4.apk or refresh F-Droid. Independent HTTPS checks matched all 21 public payload files, verified both signed indexes and all four APK signatures/hashes, and confirmed version 4 is recommended. The APK SHA-256 is `ea2847869678139709399e1800f74b49b81a359f0199c0fc77096739b14acf86`. The distribution commit is `c8cefce8c3477915fe036d80a2ed8757d21d8916`; source remains local and tagged `v0.1.0-beta.4`. Test evidence and boundaries are recorded in [the Frost nova test report](docs/testing/frost-nova.tdd.md), following [the feature plan](docs/frost-nova-plan.md).


Validation for beta 4: 75 unit tests, 99.28% line coverage and 98.95% branch coverage in the configured game/save/art modules, 15 browser tests, 18 release-helper tests, and a successful Android beta build. Code and security reviews found no critical or high issues. Four existing moderate development-tool advisories remain; no dependencies changed. Physical Android and F-Droid client update testing remain pending.

## Regions and soldiers — beta 5 candidate

Local development adds purchase confirmations, larger wave/status text, five distinct region routes and independently trained tower soldiers. Squads cost 30 diamonds; each survivor returns 15 at wave end. Training costs 35 then 70 diamonds and persists in the existing save format, with older saves defaulting to level 1. A squad's combat and refunds share the ordinary wave resolver, including Frost nova kills.

The beta 4 source tag is retained unchanged. Two Sunburst terrain concepts were generated for approval with the existing OpenCode/OpenRouter key; provenance is in `output/imagegen/terrain-concept-*-v1.json`. The user accepted B; five individual matching backgrounds are now bundled offline. Beta 5 is a local candidate, not yet the public F-Droid recommendation. See [test evidence](docs/testing/regions-soldiers.tdd.md).
