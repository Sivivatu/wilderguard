"""Contract tests for the private-input-safe F-Droid beta publisher."""
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts' / 'fdroid_beta.py'
PACKAGE = 'com.wilderguard.game.beta'


def load_publisher():
    spec = importlib.util.spec_from_file_location('fdroid_beta', SCRIPT)
    if spec is None or spec.loader is None:
        raise ImportError(f'Cannot load publisher module from {SCRIPT}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def release(code: int, version: str, **changes) -> dict:
    record = {
        'versionCode': code,
        'versionName': version,
        'tag': f'v{version}',
        'apkName': f'{PACKAGE}_{code}.apk',
        'sha256': f'{code:064x}',
        'sourceSha256': 'a' * 64,
        'addedAt': 1_800_000_000 + code,
    }
    record.update(changes)
    return record


class FingerprintTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.publisher = load_publisher()

    def test_normalizes_uppercase_and_colon_separated_fingerprint(self):
        fingerprint = ':'.join(['AB'] * 32)
        self.assertEqual(self.publisher.normalize_fingerprint(fingerprint), 'ab' * 32)

    def test_accepts_plain_lowercase_fingerprint(self):
        value = '0123456789abcdef' * 4
        self.assertEqual(self.publisher.normalize_fingerprint(value), value)

    def test_rejects_malformed_fingerprints(self):
        for value in ('', 'ab' * 31, 'ab' * 33, 'g0' * 32, 'ab:cd'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.publisher.normalize_fingerprint(value)


class VersionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.publisher = load_publisher()

    def test_accepts_numbered_semver_beta_versions(self):
        for code, version in ((1, '0.1.0-beta.1'), (12, '2.10.3-beta.42')):
            with self.subTest(version=version):
                self.publisher.validate_version(code, version)

    def test_rejects_zero_or_negative_version_codes(self):
        for code in (0, -1):
            with self.subTest(code=code), self.assertRaises(ValueError):
                self.publisher.validate_version(code, '0.1.0-beta.1')

    def test_rejects_versions_outside_the_numbered_beta_format(self):
        for version in ('0.1-beta.1', '0.1.0', '0.1.0-beta', '0.1.0-beta.x', 'v0.1.0-beta.1'):
            with self.subTest(version=version), self.assertRaises(ValueError):
                self.publisher.validate_version(1, version)


class ReleaseMergeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.publisher = load_publisher()

    def test_appends_a_newer_immutable_release_without_mutating_previous_list(self):
        first = release(1, '0.1.0-beta.1')
        second = release(2, '0.1.0-beta.2')
        previous = [first]

        merged = self.publisher.merge_release(previous, second)

        self.assertEqual(merged, [first, second])
        self.assertIsNot(merged, previous)
        self.assertEqual(previous, [first])

    def test_allows_idempotent_republication_of_the_latest_exact_record(self):
        latest = release(2, '0.1.0-beta.2')
        previous = [release(1, '0.1.0-beta.1'), latest]

        merged = self.publisher.merge_release(previous, dict(latest))

        self.assertEqual(merged, previous)
        self.assertIsNot(merged, previous)

    def test_rejects_changed_apk_hash_or_metadata_for_a_published_version(self):
        latest = release(2, '0.1.0-beta.2')
        previous = [latest]
        changes = (
            {'sha256': 'f' * 64},
            {'apkName': f'{PACKAGE}_different.apk'},
            {'sourceSha256': 'e' * 64},
            {'tag': 'v0.1.0-beta.99'},
            {'addedAt': latest['addedAt'] + 1},
        )
        for change in changes:
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.publisher.merge_release(previous, {**latest, **change})

    def test_rejects_older_or_equal_unpublished_version_codes(self):
        previous = [release(2, '0.1.0-beta.2')]
        for candidate in (release(1, '0.1.0-beta.1'), release(2, '0.1.0-beta.3')):
            with self.subTest(candidate=candidate), self.assertRaises(ValueError):
                self.publisher.merge_release(previous, candidate)

    def test_rejects_reusing_an_existing_version_name_for_a_new_code(self):
        previous = [release(1, '0.1.0-beta.1')]
        with self.assertRaises(ValueError):
            self.publisher.merge_release(previous, release(2, '0.1.0-beta.1'))


class PublicFileAllowlistTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.publisher = load_publisher()

    def assert_public(self, value: str):
        self.publisher.validate_public_file(Path(value))

    def assert_private(self, value: str):
        with self.subTest(path=value), self.assertRaises(ValueError):
            self.publisher.validate_public_file(Path(value))

    def test_allows_fdroid_index_and_landing_page_payloads(self):
        names = (
            'index.jar', 'index.xml', 'index-v1.jar', 'index-v1.json', 'index-v2.json',
            'entry.jar', 'entry.json', 'index.html', 'index.css', 'index.png',
        )
        for name in names:
            with self.subTest(name=name):
                self.assert_public(name)

    def test_allows_only_expected_package_apks(self):
        self.assert_public(f'{PACKAGE}_1.apk')
        self.assert_public(f'{PACKAGE}_123456.apk')
        self.assert_private('other.application_1.apk')
        self.assert_private(f'{PACKAGE}_latest.apk')
        self.assert_private(f'{PACKAGE}_1.APK')

    def test_allows_localized_icons_and_public_images_with_image_extensions(self):
        for value in (
            'icons/icon.png', 'icons-320/icon.webp', 'icons-320/icon.jpg',
            f'{PACKAGE}/en-US/images/feature-graphic.png',
            f'{PACKAGE}/en-US/images/screenshot-01.jpeg',
        ):
            with self.subTest(path=value):
                self.assert_public(value)

    def test_allows_numbered_fdroid_diff_files(self):
        self.assert_public('diff/1.json')
        self.assert_public('diff/42.json')
        self.assert_private('diff/index.json')
        self.assert_private('diff/1.xml')
        self.assert_private('diff/nested/1.json')

    def test_rejects_signing_material_config_secrets_and_unexpected_files(self):
        for value in (
            'config.yml', 'keystore.jks', 'key.der', 'private.pem', 'passwords.txt',
            '.env', 'release-manifest.json', f'{PACKAGE}/metadata.yml', 'README.md',
            f'{PACKAGE}/en-US/images/readme.txt', 'icons/icon.svg',
        ):
            self.assert_private(value)

    def test_rejects_parent_traversal_and_absolute_paths(self):
        for value in ('../config.yml', f'{PACKAGE}/../../secret.jks', '/tmp/private.pem'):
            self.assert_private(value)
        with self.assertRaises(ValueError):
            self.publisher.validate_public_file(Path('safe/../config.yml'))


if __name__ == '__main__':
    unittest.main()

class ApkSignatureSchemeTests(unittest.TestCase):
    def test_requires_legacy_and_modern_android_signature_schemes(self):
        from unittest.mock import patch
        publisher = load_publisher()
        pin = 'a' * 64
        valid = ('Verified using v1 scheme (JAR signing): true\n'
                 'Verified using v2 scheme (APK Signature Scheme v2): true\n'
                 'Signer #1 certificate SHA-256 digest: ' + pin + '\n')
        with patch.object(publisher, 'run', return_value=valid):
            publisher.verify_apk(Path('beta.apk'), Path('apksigner'), pin)
        for scheme in ['v1', 'v2']:
            incomplete = valid.replace('Verified using ' + scheme + ' scheme', 'Missing ' + scheme)
            with patch.object(publisher, 'run', return_value=incomplete):
                with self.assertRaises(ValueError):
                    publisher.verify_apk(Path('beta.apk'), Path('apksigner'), pin)
