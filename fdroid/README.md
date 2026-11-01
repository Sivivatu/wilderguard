# Wilderguard Beta: installation and release notes

## For players

Wilderguard Beta is an unlisted, developer-operated F-Droid repository. It is **not submitted to F-Droid’s official app catalog**. Open <https://sivivatu.github.io/wilderguard-beta/> on the Android device, install F-Droid if needed, tap **Add beta to F-Droid**, approve the repository in F-Droid, and install Wilderguard Beta. The page also links the signed APK for direct installation.

The beta package is `com.wilderguard.game.beta` (`0.1.0-beta.2`, versionCode 2), so it installs alongside the original debug preview. The two apps have separate local saves; progress does not transfer. It supports API 22 and newer with an up-to-date Android WebView, targets API 34, and is intended for a landscape Samsung Tab S4. Physical-device and F-Droid client installation checks are pending.

The public page and repository are meant to contain only install material: the landing page, signed APK, F-Droid indexes and metadata, images, and published certificate fingerprints. The public GitHub Pages source repository `Sivivatu/wilderguard-beta` distributes this static payload and does not contain this game’s source code. The distribution link is public; “unlisted” only means it is outside F-Droid’s official catalog. Anyone with the URL can fetch the assets. Do not describe this as private distribution.

**Publication check (1 November 2026):** The live page is <https://sivivatu.github.io/wilderguard-beta/> and the feed is <https://sivivatu.github.io/wilderguard-beta/fdroid/repo>. An independent HTTPS download verified the live page, images, robots/noindex directives, both signed F-Droid index formats, the APK hash, its permanent signing certificate, and APK v1/v2 signature schemes. F-Droid client installation and a two-version update have not been verified.

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

## Licensing and testing status

The F-Droid metadata currently uses `License: Unknown`; Eric has not chosen a source-code or app license. Do not mark this project open source or claim the source is available until the creator and family choose and publish an appropriate license and source repository.

Beta 0.1.0-beta.2 (versionCode 2) is published at the install page and feed above, and is the recommended version in the signed indexes. Beta 1 remains available unchanged. HTTPS downloads and the live signed repository and APK were verified on 1 November 2026. An interrupted emulator check did not establish F-Droid client installation. A physical Samsung Tab S4 and a two-version client update still need testing. Refresh the repository in F-Droid to receive beta 2, or download its [signed APK](https://sivivatu.github.io/wilderguard-beta/fdroid/repo/com.wilderguard.game.beta_2.apk) directly.
