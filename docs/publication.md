# Public source and Android releases

The owner authorized public source publication after the initial Sentry implementation. The source repository is [Sivivatu/wilderguard](https://github.com/Sivivatu/wilderguard). `main` contains the existing beta 9 source; `feat/sentry-error-reporting` is submitted separately for review. Publishing that branch does not include Sentry in a released APK.

Git history was checked before the initial upload: 25 commits and 316 unique blobs across the published branches and existing version tags. No tracked credentials, signing files, local saves, source maps or ignored artifacts were found. This is a bounded heuristic audit, not proof that every possible credential format can be recognized. Existing author metadata and references to Eric are public with the source. An app/source license has not been chosen; public visibility does not establish an open-source license or eligibility for F-Droid's official catalog.

## APK releases and F-Droid

The same source repository can host [GitHub Releases](https://github.com/Sivivatu/wilderguard/releases), with signed APKs attached to their source version tags. The initial release asset mirrors the already-published beta 9 APK byte-for-byte, with its SHA-256 checksum. It is not a newly built or reporting-enabled release. Earlier APKs remain available through the existing feed.

F-Droid clients require signed repository indexes as well as APK files; a GitHub Releases page alone is not an F-Droid feed. Existing installations continue to use:

- Install page: <https://sivivatu.github.io/wilderguard-beta/>
- Signed feed: <https://sivivatu.github.io/wilderguard-beta/fdroid/repo>

Those URLs, both permanent signing identities, existing signed indexes and previously released APK bytes are preserved. The separate `wilderguard-beta` repository continues serving this feed. Consolidating the feed into a Pages branch in the source repository is possible, but requires a tested signed-index/URL migration; it is not part of source publication. Do not simply point installed clients at a GitHub Releases URL.

## Tag-based release workflow

The source repository is adding [`.github/workflows/beta-release.yml`](../.github/workflows/beta-release.yml). Once this workflow is reviewed and merged into `main`, pushes of `vX.Y.Z-beta.N` tags run the release pipeline. A tag must identify a commit on `main`; the tag, Android Gradle version, and F-Droid recommended version must agree. Pull requests and branch builds run the tests and create no signed release.

The first new publication must use versionCode 10 or higher and a unique numbered beta name. Beta 9 remains the current live release. Updating review code does not create a new app release. Sentry is explicitly disabled in the release workflow until native crash, offline/reconnect, and device validation is complete; no source maps or debug artifacts are uploaded.

The release job runs only after a maintainer approves the `beta-release` environment. The source repository has the eight existing APK/F-Droid signing values as encrypted Actions environment secrets plus a dedicated SSH deploy key that can write only to `Sivivatu/wilderguard-beta`. The deploy key is separate from both permanent app/feed signing keys. Restrict environment deployments to numbered beta tags and prevent tag changes or deletion. The job verifies retained APKs, signed indexes and permanent certificate pins before publishing.

A successful tag publishes the allowlisted F-Droid payload to the existing `wilderguard-beta` `main` branch and pushes a matching tag there in one atomic Git operation. After checking the live Pages payload, it creates a source-repository prerelease containing the same signed APK, its SHA256SUMS, and a source-bound receipt. Existing APK bytes and prior receipts stay immutable; retries use the original published APK. The workflow checks that Pages serves the manifest, APK, and signed indexes from the new distribution commit. The install page and feed URLs remain unchanged.

To publish after the workflow is active, review and merge the source/version/metadata change, then push its numbered tag. Do not tag an unreviewed commit. Never reuse a `versionCode`, `versionName`, or published tag. Publish one new tag at a time; GitHub concurrency retains only one pending release run. If a run stops after feed publication, rerun the same immutable source tag after checking the failure; the receipt allows it to finish the source GitHub Release without rebuilding the feed history.

GitHub configuration was verified on 7 November 2026: the `beta-release` environment requires approval by `Sivivatu`, allows only beta tags, and disallows administrator bypass of that approval. Its nine encrypted environment secrets contain the eight existing signing inputs and the dedicated distribution deploy key. Source `main` requires the unsigned-build check and a PR; numbered beta tags are restricted to repository administrators and protected against ordinary update/deletion. The owner can still administer these protections. No tag has been published or validated through this pipeline yet. Its first real end-to-end run will be a future numbered release; beta 9 and the current review branch are not release candidates. Signing keys, `.env.local`, credentials, generated builds, and local symbolication artifacts remain private. Public source visibility does not authorize uploading debugging source or maps to Sentry.

Local setup validation passed: 345 unit tests, 32 browser scenarios, three reporting scenarios, 37 publisher/orchestration tests, Android beta build/native unit tests, and a local-only signing/feed smoke test using the permanent keys. The orchestration helper measured 89% line coverage. The hash-locked Python 3.12 environment verified all nine published APKs and both signed indexes. The temporary rebuilt beta 9 APK is a validation artifact only and must never replace the published beta 9. Hosted signing, deploy-key authentication, Pages publication and source-release creation remain unverified until a future approved tag run.
