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
- A local checkpoint between waves so a retry restores the last saved setup.
- An offline browser build, an original Android debug preview, and a separate unlisted F-Droid beta built with Capacitor 6.
- Procedural Canvas and SVG scenery, locally bundled pixel-art orc sprites, and bundled fonts with their license files.

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
