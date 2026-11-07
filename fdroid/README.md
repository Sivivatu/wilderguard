# Wilderguard Beta: installation and release notes

## For players

Wilderguard Beta is an unlisted, developer-operated F-Droid repository. It is **not submitted to F-Droid’s official app catalog**. Open <https://sivivatu.github.io/wilderguard-beta/> on the Android device, install F-Droid if needed, tap **Add beta to F-Droid**, approve the repository in F-Droid, and install Wilderguard Beta. The page also links the signed APK for direct installation.

The beta package is `com.wilderguard.game.beta`. Beta `0.1.0-beta.9` (versionCode 9) is recommended by the live signed feed and available as a [direct signed APK](https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_9.apk). It installs alongside the original debug preview with a separate save. Updating an earlier beta preserves its beta checkpoint, with older towers receiving full health. It supports API 22 and newer with an up-to-date Android WebView, targets API 34, and supports compact landscape phone play as well as the intended Samsung Tab S4. Physical-device and F-Droid client installation checks are pending.

The public page and repository are meant to contain only install material: the landing page, signed APK, F-Droid indexes and metadata, images, and published certificate fingerprints. The public GitHub Pages source repository `Sivivatu/wilderguard-beta` distributes this static payload and does not contain this game’s source code. The distribution link is public; “unlisted” only means it is outside F-Droid’s official catalog. Anyone with the URL can fetch the assets. Do not describe this as private distribution.

**Publication check (1 November 2026):** The live page is <https://sivivatu.github.io/wilderguard-beta/> and the feed is <https://sivivatu.github.io/wilderguard-beta/fdroid/repo>. An independent HTTPS download verified the live page, images, robots/noindex directives, both signed F-Droid index formats, the APK hash, its permanent signing certificate, and APK v1/v2 signature schemes. F-Droid client installation and a two-version update have not been verified.

**Beta 5 check (4 November 2026):** All 22 files downloaded independently from both the public release tag and GitHub Pages matched the validated payload exactly, including all five immutable APKs, permanent certificates, signed v1/v2 indexes, v1 suggested version 5 and v2 normal release channels. The first Pages deployment failed with HTTP 502 and its retry became stale during a GitHub service incident. A fresh Pages build (`41875559990`) succeeded using the unchanged distribution commit. The live Pages feed now recommends beta 5.

## Release requirements

- Build an unsigned beta with Java 17, `ANDROID_HOME` pointing to the local Android SDK, and the required Android build tools installed:

  ```sh
  npm run android:beta
  ```

  The expected input is `android/app/build/outputs/apk/beta/app-beta-unsigned.apk`. The native beta app has a separate application ID, is not debuggable, and uses an immutable numbered beta name/code.

- Run the publisher with `fdroidserver==2.4.5` in its own Python virtual environment. Install it with `uv tool install fdroidserver==2.4.5`; in the currently provisioned environment its Python is `~/.local/share/uv/tools/fdroidserver/bin/python`. Use that interpreter to run `scripts/fdroid_beta.py`, so its imported `fdroidserver` package is the pinned version.
- Set the Android SDK path through the local `ANDROID_HOME` environment variable. The publisher uses Android build-tools 34.0.0 to read package metadata and verify/sign the APK.
- Restore signing credentials from Infisical, using the dedicated EU project and environment/path below. The eight required names are listed under **Signing credentials**. Never print their values, paste them into chat, add them to a command-line argument, or commit an export.
- Hash the canonical source manifest for `--source-sha256`. It is a sorted JSON array of explicitly selected Android and game build files, each recorded as `{ "path", "sha256" }`; hash the manifest bytes with SHA-256. The original beta 1 manifest is `artifacts/beta-source-manifest.json`; beta 2 uses `artifacts/beta-orcs-source-manifest.json`. Preserve the manifest associated with each immutable APK and create a fresh one for a new build. This is a build-source snapshot digest; it does not publish or license the source code.
- For beta 3, preserve a fresh, sorted manifest for the Android build and all web assets included in the APK, including the compact battle UI, defense guide, and shared combat-stat code. Do not reuse the beta 2 manifest. Keep the manifest private with the other local build provenance.
- Set `CurrentVersion` and `CurrentVersionCode` in `fdroid/metadata/com.wilderguard.game.beta.yml` to the new release before generating the signed feed. Verify the v1 suggested version and v2 release channels recommend the latest version; retaining the old recommendation can hide the update behind the beta channel.
- Give the publisher separate paths for persistent state and public output. State retains the signing certificate pins, previous signed indexes, and every released APK. The public output must start empty and contain only the validated install payload. Never publish state, the source manifest, secret exports, keystores, or signing configuration.
- Publish the validated output to the static distribution repository only after the complete release check. No CI secret mirror is configured; run the signing/publishing workflow locally.

### Signing credentials

The eight values in Infisical `prod/android-signing` are:

```text
APK_KEYSTORE_BASE64
APK_KEYSTORE_PASSWORD
APK_KEY_ALIAS
APK_KEY_PASSWORD
FDROID_KEYSTORE_BASE64
FDROID_KEYSTORE_PASSWORD
FDROID_KEY_ALIAS
FDROID_KEY_PASSWORD
```

The dedicated Infisical EU project is `wilderguard` (`2b08b93e-4a30-483f-86f8-eaa680d1fcc0`). The `battery-monitor-eu` CLI profile is used only to identify/authenticate the existing Infisical account; do not reuse signing keys from that or any other project. The signing key backups were restored byte-for-byte and checked against the permanent public pins in [`signing-certificates.json`](signing-certificates.json).

The backed-up signing files are kept locally under `~/.local/share/wilderguard-signing`, with directory permissions `700` and key files `600`. The publisher independently restores temporary keystores into a mode-`700` private temporary directory, checks each certificate against its permanent SHA-256 pin, signs and verifies the APK, then removes that directory. It verifies both APK signature schemes, validates immutable version codes and names, and retains released APKs and signed indexes between publications.

For an owner-only transient export, first authenticate the CLI using the intended `battery-monitor-eu` identity. This example exports the credentials to a protected temporary file, loads them only into the current subshell, and removes the file when the publisher exits. It includes no credential values:

```sh
(
  umask 077
  secrets_file="$(mktemp "${TMPDIR:-/tmp}/wilderguard-signing.XXXXXX")"
  trap 'rm -f "$secrets_file"' EXIT
  infisical export --profile=battery-monitor-eu --silent --domain=https://eu.infisical.com \
    --projectId=2b08b93e-4a30-483f-86f8-eaa680d1fcc0 \
    --env=prod --path=/android-signing --format=dotenv > "$secrets_file"
  chmod 600 "$secrets_file"
  set -a
  . "$secrets_file"
  set +a
  source_sha256="$(sha256sum artifacts/beta-source-manifest.json | cut -d ' ' -f 1)"
  ~/.local/share/uv/tools/fdroidserver/bin/python scripts/fdroid_beta.py \
    --apk android/app/build/outputs/apk/beta/app-beta-unsigned.apk \
    --state artifacts/fdroid-state \
    --output artifacts/fdroid-public \
    --source-sha256 "$source_sha256"
)
```

The source manifest is sensitive build provenance and stays private. Keep the persistent state directory backed up securely. The output directory must be separate from state and empty for a new publish attempt; the publisher refuses a populated public-output path rather than deleting it.

### Version and custody rules

1. Every beta release gets a new, increasing `versionCode` and a unique numbered beta `versionName`. Never change a released APK or republish an old version under different bytes.
2. Keep both signing keys and the public fingerprint pins permanent. Do not regenerate either keystore or copy keys from the original preview, `battery-monitor-eu`, or another app.
3. Retain earlier signed APKs and signed F-Droid indexes in persistent state so F-Droid clients can verify updates.
4. Keep signing state, release manifest, and source provenance private and apart from the static public payload.
5. Check advisories with `npm audit` for every release; the dependency set may change. A prior clean audit does not promise a future one.
6. There is no CI secret mirror. All release signing and feed generation happens locally using the dedicated vault path.
### Error-reporting release gate

Published beta 8 remains unchanged and has no Sentry reporting. This worktree prepares automatic error-only reporting with a privacy notice/off switch for a future configured EU build. Before publishing such a release, complete [Sentry setup and delivery/device validation](../docs/error-reporting.md), verify the selected €0/free-only policy with no paid overages, inspect the signed APK for maps/credentials, and update feed privacy/anti-feature disclosures to match actual behavior. Preserve local symbolication artifacts privately. This code review does not publish a reporting-enabled app release. See [public source and APK releases](../docs/publication.md) for the separate publication workflow.

Code-review commits and pushes do not publish an app release. Version tags record source checkpoints and the separate binary-distribution commits. Publication explicitly builds and signs a new numbered APK, generates signed F-Droid indexes, and publishes the validated binary-only payload through the distribution repository and Pages. Creating a source tag alone does not run that process.

## Licensing and testing status

The F-Droid metadata currently uses `License: Unknown`; Eric has not chosen a source-code or app license. The owner has authorized public source publication to [Sivivatu/wilderguard](https://github.com/Sivivatu/wilderguard). Public source visibility does not establish an open-source license or eligibility for F-Droid's official catalog; keep the license field unchanged until the creator and family select an appropriate license.

Beta `0.1.0-beta.4` (versionCode 4) is published with level 3 Frost nova. Refresh F-Droid or download the [signed APK](https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_4.apk). On 1 November 2026, independent HTTPS downloads verified all 21 payload files, all four APK hashes and v1/v2 signatures, permanent signing pins, both signed index formats, v1 suggested version 4 and v2 normal release channels. Betas 1–3 remain unchanged. Physical Samsung Tab S4 installation and an actual F-Droid client update remain unverified.

Beta 3 source manifest: `artifacts/beta-phone-source-manifest.json`, SHA-256 `6295e2063177f76f1bb5908fa8b4dde06c1a6a88cf6ea3bde490fa74df36189c`. The preserved state containing the first three releases is `artifacts/fdroid-state-before-beta4`; its beta 2 backup is `artifacts/fdroid-state-before-beta3`. Live verification material is retained at `artifacts/fdroid-beta3-live-check`. These private build records stay out of the public distribution repository.

Beta 4 source manifest: `artifacts/beta-frost-nova-source-manifest.json`, SHA-256 `6b5ea6253405326895e850f38643aecbf9e99394be330be543078852c66c6ec3`. Its four-release signing state is preserved in `artifacts/fdroid-state-before-beta5`; live verification material is in `artifacts/fdroid-beta4-live-check`. Source inputs are tagged locally as `v0.1.0-beta.4`.

Beta 5 source manifest: `artifacts/beta-regions-soldiers-source-manifest.json`, SHA-256 `9622e3936e939cc1271718d3144e43c4f57c9bbc6373a2d412c083b180a47ae8` (84 inputs). APK SHA-256: `a3dfab70311d70eb8460ccb568f9c41ad417ea4d05984691ed52a135ffa50fef`. Distribution commit: `6c784036e7019a429d966ac8be05007ad0d8e5db`, with annotated tag `v0.1.0-beta.5`. Source build inputs match local commit `bcfa0b2`; the source/docs checkpoint is tagged locally as `v0.1.0-beta.5` and is not pushed.

Beta 5's five-release state is preserved in `artifacts/fdroid-state-before-beta6`; beta 4 state is preserved in `artifacts/fdroid-state-before-beta5`. Tag-download verification material is in `artifacts/fdroid-beta5-tag-live-check`, and Pages verification material is in `artifacts/fdroid-beta5-live-check`. The verifier is preserved in `artifacts/verify-beta5-pages.py` and uses the pinned fdroidserver interpreter, Java 17 and `ANDROID_HOME`. Old run `41809491578` remains a stale retry: both cancellation endpoints returned HTTP 409, stating it had not actually queued. Inspect job and attempt state before retrying a stalled deployment; the Pages status alone did not expose the failure. All private records and signing state stay out of the public distribution repository.

**Beta 6 check (5 November 2026):** Pages deployment `42021571759` succeeded from distribution commit `c33ead776256ed3a3fd2c56639c1bc29b6c3a76f`, tagged `v0.1.0-beta.6`. Independent HTTPS downloads matched all 23 public payload files, both signed indexes, all six APK hashes and v1/v2 signatures, permanent certificate pins, v1 suggested version 6 and v2 normal release channels. Earlier APK bytes are unchanged. The signed APK is 5,172,806 bytes, SHA-256 `774734eec76e23e477a5fe60b883d2744a1726c72f427c010a9ea30dfced21a2`.

Beta 6 source manifest: `artifacts/beta-siege-source-manifest.json`, SHA-256 `7b973043c11a83aee70c58dcc95964292e1bc3e118b3eb50cb6c7aa4863cc7fe` (88 inputs), matching source commit `384012c3eb90370540415e5850fa6953c9f7290c`. Beta 6's six-release state is preserved in `artifacts/fdroid-state-before-beta7`, with older state backed up as above. Live downloads and verifier are preserved in `artifacts/fdroid-beta6-live-check` and `artifacts/verify-beta6-pages.py`; the private receipt is `artifacts/beta6-verification.json`. The final source/docs checkpoint is tagged locally as `v0.1.0-beta.6`; source remains unpushed. Physical Android and F-Droid client update testing remain unverified.

**Beta 7 check (5 November 2026):** Pages deployment `42023892901` succeeded from distribution commit `a8a318e8e1984084b1778ff5f12cd6a5b61271fb`, tagged `v0.1.0-beta.7`. Independent downloads from the public tag and Pages matched all 24 files and verified both signed indexes, all seven APK hashes and v1/v2 signatures, permanent pins, v1 suggested version 7 and v2 normal release channels. The APK is 5,172,806 bytes, SHA-256 `0beb929a7ffcc352fa075d8ed68e404cf96b9f56a050e563307e0f576e19a901`. All earlier APKs are unchanged.

Beta 7 source manifest: `artifacts/beta-frost-targeting-source-manifest.json`, SHA-256 `58981675a0c6f6c380af9f0f975502022362d1c6352b647a4937fa2924a1fc2d` (88 inputs), matching source commit `c0b8b49`. Beta 7's seven-release state is preserved in `artifacts/fdroid-state-before-beta8`; its six-release backup is `artifacts/fdroid-state-before-beta7`. Private verification: `artifacts/beta7-verification.json`, `artifacts/verify-beta7-pages.py`, and the `artifacts/fdroid-beta7-live-check` / `artifacts/fdroid-beta7-tag-live-check` downloads. The final source/docs checkpoint is tagged locally as `v0.1.0-beta.7`; source remains unpushed. Physical Android and actual F-Droid client updates remain unverified.

**Beta 8 check (5 November 2026):** Pages deployment `42067570304` succeeded from distribution commit `1dab5c1ec80e2ad339e3330b485c3e431a829d69`, tagged `v0.1.0-beta.8`. Independent tag and Pages downloads matched all 25 public files and verified both signed indexes, all eight APK hashes and v1/v2 signatures, permanent pins, v1 suggested version 8 and v2 normal release channels. The APK is 5,172,806 bytes, SHA-256 `1d6dbe788758dce5190b557c3eb1e665a565d89993d90c1c320f699d6d11d03a`. All earlier APKs are unchanged.

Beta 8 source manifest: `artifacts/beta-frost-levels-source-manifest.json`, SHA-256 `c92cc760caa955598dd367cfa00b737c2c7e7d153edb64a1dc5b53471b232c49` (88 inputs), matching source commit `b842860ed66d8565329e31036d0ef589a27be9d5`. Canonical state retains eight releases; its seven-release backup is `artifacts/fdroid-state-before-beta8`. Private receipts and checks are in `artifacts/beta8-verification.json`, `artifacts/verify-beta8-pages.py`, `artifacts/fdroid-beta8-live-check` and `artifacts/fdroid-beta8-tag-live-check`. The final source/docs checkpoint is tagged locally as `v0.1.0-beta.8`; source remains unpushed. Physical Android and actual F-Droid client updates remain unverified.

**Beta 9 check (6 November 2026):** Pages deployment `42213863904` succeeded from distribution commit `0fef51fdcf41d86148edc70248bfe00eeef2854d`, tagged `v0.1.0-beta.9`. Independent tag and Pages downloads matched all 26 public files and verified both signed indexes, all nine APK hashes and v1/v2 signatures, permanent pins, v1 suggested version 9 and v2 normal release channels. The APK is 5,172,806 bytes, SHA-256 `286e4d73d783ab36565293585215977ab4a31941d241acf50cd5eae3e16662fe`. All eight earlier APKs remain unchanged.

Beta 9 source manifest: `artifacts/beta-tower-reach-source-manifest.json`, SHA-256 `b9e7f6465c91c6d5f5e346e5430fc07fe8339d13bf20227a75bb7dddc0580c47` (88 inputs), matching source commit `7d46648c6b2258d2771c9cd90685f8d76a4d7024`. Canonical state retains nine releases; its eight-release backup is `artifacts/fdroid-state-before-beta9`. Private receipts and checks are in `artifacts/beta9-verification.json`, `artifacts/verify-beta9-pages.py`, `artifacts/fdroid-beta9-live-check` and `artifacts/fdroid-beta9-tag-live-check`. The final source/docs checkpoint is tagged locally as `v0.1.0-beta.9`; source remains unpushed. Physical Android and actual F-Droid client updates remain unverified.
