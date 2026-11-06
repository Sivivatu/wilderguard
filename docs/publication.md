# Public source and Android releases

The owner authorized public source publication after the initial Sentry implementation. The source repository is [Sivivatu/wilderguard](https://github.com/Sivivatu/wilderguard). `main` contains the existing beta 9 source; `feat/sentry-error-reporting` is submitted separately for review. Publishing that branch does not include Sentry in a released APK.

Git history was checked before the initial upload: 25 commits and 316 unique blobs across the published branches and existing version tags. No tracked credentials, signing files, local saves, source maps or ignored artifacts were found. This is a bounded heuristic audit, not proof that every possible credential format can be recognized. Existing author metadata and references to Eric are public with the source. An app/source license has not been chosen; public visibility does not establish an open-source license or eligibility for F-Droid's official catalog.

## APK releases and F-Droid

The same source repository can host [GitHub Releases](https://github.com/Sivivatu/wilderguard/releases), with signed APKs attached to their source version tags. The initial release asset mirrors the already-published beta 9 APK byte-for-byte, with its SHA-256 checksum. It is not a newly built or reporting-enabled release. Earlier APKs remain available through the existing feed.

F-Droid clients require signed repository indexes as well as APK files; a GitHub Releases page alone is not an F-Droid feed. Existing installations continue to use:

- Install page: <https://sivivatu.github.io/wilderguard-beta/>
- Signed feed: <https://sivivatu.github.io/wilderguard-beta/fdroid/repo>

Those URLs, both permanent signing identities, existing signed indexes and previously released APK bytes are preserved. The separate `wilderguard-beta` repository continues serving this feed. Consolidating the feed into a Pages branch in the source repository is possible, but requires a tested signed-index/URL migration; it is not part of source publication. Do not simply point installed clients at a GitHub Releases URL.

## Future release workflow

1. Review and merge the intended code separately from publishing an app release. Sentry still needs native crash/offline/device validation before a reporting-enabled release.
2. Allocate a new increasing Android version code and unique beta version name; never replace an existing version with different bytes. Update Sentry release/build configuration and privacy disclosures when applicable.
3. Run the relevant game, reporting, Android and release-helper checks. Build and sign locally using the existing permanent key; inspect the APK and preserve matching private debugging artifacts.
4. Tag the reviewed source checkpoint. Attach the matching signed APK and checksum to a GitHub Release using an existing tag (`gh release create --verify-tag`); do not let a release silently create a tag at an unrelated source revision.
5. Generate and verify the signed F-Droid indexes and publish the validated binary payload using the [existing publisher runbook](../fdroid/README.md). Confirm the live feed recommends the intended version and retains older immutable APKs.

A source push, review PR or version tag does not automatically build, sign or publish a new APK. No release-signing secrets are configured in GitHub Actions. Signing keys, `.env.local`, credentials, generated builds and local source-map archives stay out of Git; making the repository public does not authorize uploading debugging sources or maps to Sentry.
