# Wilderguard

Public source: [Sivivatu/wilderguard](https://github.com/Sivivatu/wilderguard). Signed APKs can also be downloaded from [GitHub Releases](https://github.com/Sivivatu/wilderguard/releases); existing F-Droid installations keep using the feed below. See [source, releases and publication](docs/publication.md).

**Made by Eric, a 7-year-old boy.**

A pixel-art tower-defense adventure through Elderglen: five places to free, five waves in each, and a little kingdom worth protecting. Build your defenses, hold back waves of orcs, and bring the country home.

## Unlisted Android beta

Wilderguard Beta (`com.wilderguard.game.beta`, version `0.1.0-beta.8`, versionCode 8) gives Frost towers a 35% chill chance at level 1, 50% at level 2 and 85% at level 3, while preferring unchilled mobs. It includes visible castle and tower health, paid tower repairs, ranged axe-throwing orcs and working fullscreen controls where supported. Other features include purchase confirmations, independently trained soldiers, five distinct roads with approved pixelated photographic terrain, the compact phone interface, tower/spell guide, and contagious level 3 Frost nova. It is separate from the original Android preview and does not import that preview's saved progress. Updates from an earlier beta preserve the beta's checkpoint saves. This is a developer-run repository, **not an app in F-Droid’s official catalog**. Anyone who has the public link can access its downloads; “unlisted” does not provide privacy or access control.

**Beta 8's public page, signed feed, and APK were verified live on 5 November 2026.** Download the [signed beta 8 APK](https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_8.apk) directly to update now. For F-Droid installation:

1. [Install F-Droid](https://f-droid.org/F-Droid.apk) if it isn’t already on the device.
2. Open the [Wilderguard Beta install page](https://sivivatu.github.io/wilderguard-beta/) on the tablet and tap **Add beta to F-Droid**. Confirm adding the repository in F-Droid.
3. Find **Wilderguard Beta** in F-Droid and tap **Install**. Allow F-Droid to install apps if Android asks.

The install page includes the signing details. The app targets Android API 34, supports API 22 and newer with a modern WebView, and opens in landscape. Physical Tab S4 testing is pending. See [F-Droid beta notes](fdroid/README.md) for publisher and repository details.

The live feed recommends beta 8. Refresh the repository in F-Droid to update. All eight signed APKs are retained; betas 1–7 remain unchanged and use the same permanent signing identity.

## Play

The accepted terrain style B remains bundled offline. The beta 7 source tag is preserved as the working reference before the level-scaled Frost chances.

Pick a tower, tap a marked place on the map, confirm its diamond cost, and start the wave when you’re ready. Tower upgrades also ask for confirmation; canceling spends nothing and closing a dialog restores your previous pause state. Archer towers fire quickly for 15 damage every 0.7 seconds at range 185. Cannons deal 35 damage every 1.65 seconds at range 170, and splash nearby enemies. Frost towers deal 8 damage every 0.8 seconds at range 165, with a 35% chance per hit at level 1, 50% at level 2 and 85% at level 3 to slow a target by 50% for 2 seconds (65% / 50% / 15% failure). They prefer enemies in range that are not already chilled, checking before every shot so new arrivals take priority over chilled mobs. If all targets are chilled, they keep attacking. Damage always lands; failed chills do not refresh existing slow or level 3 nova marks. Tap a built tower to see its level-specific damage, firing interval, range and upgrades, or open **Tower & spell guide** for all the details. Upgrades increase damage, range and speed; sell a tower for 60% of what you spent.

The guide is available by touch at any time, including when spells are disabled or empty. It explains that Deep Freeze slows the wave by 88% for 6 seconds, Starfall deals 110 damage to visible monsters in the first region (adding 25% of its base damage per region), and Mending Light restores 6 health up to 20. Descriptions and combat use the same stat calculations.

Level 3 Frost towers unlock **Frost nova**: if a mob dies while its level 3 Frost chill is active, an icy blast slows living, visible mobs within 90 battlefield units by 50% for 2 seconds. Any tower or Starfall can trigger the burst; newly chilled mobs can spread it again if they die before the slow expires. The blast adds no damage. Levels 1 and 2 and Deep Freeze alone do not trigger Frost nova.

Tap a built tower and choose **Soldiers** to send a two-soldier squad during a wave for 30 diamonds, once per tower per wave. Soldiers march out, block orcs and fight. Each survivor refunds 15 diamonds when the wave is cleared; fallen soldiers refund nothing. Train future squads separately from towers: level 1 has 50 health and 10 damage, level 2 has 80 health and 16 damage, and level 3 has 120 health and 24 damage. Soldiers attack every 0.8 seconds. Training upgrades cost 35 then 70 diamonds and carry between regions.

Each region has a different road, shared by the renderer and combat rules. The battlefield status and wave counter use larger text while keeping the compact phone layout.

The **Castle current/20** meter and bar above the castle show its remaining health. Escaping orcs cause a brief hit outline, floating damage and a message naming the damaged structure. Towers also have health bars and exact HP in their details. Archer towers start at 180 HP, Cannon at 220 and Frost at 170; upgrades add 80 HP to the maximum and remaining health, preserving existing damage. Tap a damaged tower for a confirmed diamond repair. Damage carries between waves, and Mending Light heals the castle rather than towers.

**Axe-throwing orcs** first arrive midway through Greenfields wave 3, after its opening enemies. They attack the nearest tower within 175 battlefield units every 2 seconds for 8 damage in the first region, adding 2 damage per region. Send soldiers to engage them and interrupt their throws. A destroyed tower leaves its pad available to rebuild, with no destruction refund; soldiers already sent from it keep fighting and remain eligible for survivor refunds.

Win diamonds after every wave. On wave 3, earn a Deep Freeze spell; on wave 5, earn Starfall. Mending Light restores kingdom health. After each region, receive an extra supply of **180 diamonds, plus 60 for each region you’ve already freed**, to help build the next defense line. Orcs grow stronger each wave across the campaign. Axe orcs join from wave 2, and an armored chieftain leads each region’s final wave.

Pause or play at 2× speed to adjust how the game feels. Supported browsers have a working fullscreen enter/exit control; the control is hidden in the Android app, installed web app and unsupported browsers. In the Android app or when installed to your home screen, the game opens directly into a touch-friendly battle view. Progress saves on this device between waves; existing beta saves give their towers full health. If monsters win, you can retry from your last saved setup, including its tower health. Your diamonds and spells carry to the next region, where you choose new towers.

Each battlefield uses a distinct pixelated photographic background in the approved Sunburst style B, with its own road drawn in Canvas. The campaign map uses SVG. Orcs use pixelated artwork generated from the concepts Eric selected. The game bundles all five backgrounds, four sprites and fonts, so battles also work offline. Wilderguard has no accounts, game server, gameplay analytics, advertising, or in-app purchases. Published beta 8 has no reporting. This worktree implements automatic Sentry error reports with a privacy notice and off switch, configured for a free-only EU project in local validation builds. No reporting-enabled release has been published. See [error reporting and privacy](docs/error-reporting.md). The Samsung Galaxy Tab S4 in landscape is the target device.

## Play in a browser

Install [Node.js](https://nodejs.org/) 24 LTS, then run:

```sh
npm install
npm run dev
```

Open the local address Vite prints. To build and preview the production version:

```sh
npm run build
npm run preview
```

The production build bundles every asset for offline use. To install the game on the tablet without an APK, serve it over HTTPS, open it in Samsung Internet or Chrome, and choose **Add to Home screen**.

## Build and install on Android

This project includes its Android app. Set `JAVA_HOME` to a JDK 17 installation and `ANDROID_HOME` to your local Android SDK before building. The Android Gradle Plugin and Gradle wrapper are included; the build may download Gradle if it is not already cached. No machine-specific SDK path is committed to the project.

```sh
npm run android:apk
```

The script rebuilds the web app, syncs Android assets, and writes a debug APK to `android/app/build/outputs/apk/debug/app-debug.apk`. Make a copy for transfer with `mkdir -p artifacts && cp android/app/build/outputs/apk/debug/app-debug.apk artifacts/Wilderguard-debug.apk`. It will then be available at [artifacts/Wilderguard-debug.apk](artifacts/Wilderguard-debug.apk). Transfer it to the Tab S4 and install it. Android may ask you to allow installation from the app you use to open it.

Capacitor 6 supports Android API 22 and newer with a modern system WebView. This project compiles and targets API 34 and sets API 22 as its minimum. The Tab S4 is intended to run it in landscape. A debug APK is for trying the game; it is not signed for a public store release.

## Development commands

```sh
npm test                         # game and save-file unit tests
npm run test:coverage             # coverage report
npx playwright install chromium   # install the browser for the end-to-end tests
npm run test:e2e                  # browser end-to-end tests
npm run test:reporting            # local intercepted error/offline delivery fixture
npm run build                     # type-check, build, and bundle offline assets
npm run android:sync              # rebuild web assets and sync Android
npm run android:apk               # build the debug APK
npm audit                         # check dependency advisories
```

A post-install compatibility patch keeps Capacitor CLI 6 working with the patched `tar` 7 dependency and safely checks its expected version and source before editing it.

## Project notes

See [NOTES.md](NOTES.md) for Eric’s original idea and the work still needed before a wider release. See [fdroid/README.md](fdroid/README.md) for the beta publishing runbook.

## Original local version control

The following records the setup before the owner authorized public publication. See [the publication workflow](docs/publication.md) for the current repository and release locations.

The complete project is tracked in a local Git repository on `main`, with source checkpoints tagged `v0.1.0-beta.2` through `v0.1.0-beta.8`. The source repository has no remote and has not been pushed. Android install material is published separately through the existing F-Droid distribution repository.

Source code, Android build files, tests, documentation, fonts, and the generated artwork concepts are included. Dependencies, generated builds, APKs, reference archives, local configuration, and signing material are ignored. Existing local artifacts remain in `artifacts/`, including the separate F-Droid distribution checkout. Signing-key custody and recovery are documented in the beta publishing runbook; keys are not part of this repository.
