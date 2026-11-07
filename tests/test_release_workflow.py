"""Tag-release guards, provenance, immutable retry, and public staging contracts."""
import importlib.util
import json
import shutil
from pathlib import Path
import tempfile
import sys
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/release_ci.py'
sys.path.insert(0, str(SCRIPT.parent))
spec = importlib.util.spec_from_file_location('release_ci', SCRIPT)
ci = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ci)


class ReleaseContracts(unittest.TestCase):
    def test_only_numbered_beta_tags_are_accepted(self):
        self.assertEqual(ci.parse_tag('v0.1.0-beta.10'), ('0.1.0-beta.10', 10))
        for tag in ['v0.1.0', 'v0.1.0-beta.0', 'v0.1.0-beta.01', '../main', 'v1.2.3-beta.10\n']:
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                ci.parse_tag(tag)

    def test_gradle_and_feed_must_match_tag(self):
        gradle = 'versionCode 10\nversionName "0.1.0"\nversionNameSuffix "-beta.10"'
        feed = 'CurrentVersion: 0.1.0-beta.10\nCurrentVersionCode: 10\n'
        ci.validate_versions('v0.1.0-beta.10', gradle, feed)
        for changed_gradle, changed_feed in [(gradle.replace('Code 10', 'Code 9'), feed),
                                             (gradle, feed.replace('Code: 10', 'Code: 9'))]:
            with self.assertRaises(ValueError):
                ci.validate_versions('v0.1.0-beta.10', changed_gradle, changed_feed)

    def test_source_digest_is_order_independent_and_sensitive_to_bytes(self):
        self.assertEqual(ci.snapshot_digest([('b', b'2'), ('a', b'1')]),
                         ci.snapshot_digest([('a', b'1'), ('b', b'2')]))
        self.assertNotEqual(ci.snapshot_digest([('a', b'1')]), ci.snapshot_digest([('a', b'2')]))

    def test_tag_must_resolve_to_checked_out_commit_on_main(self):
        with patch.object(ci, 'git', side_effect=['a' * 40, 'b' * 40]):
            with self.assertRaises(ValueError):
                ci.verify_source(Path('.'), 'v0.1.0-beta.10')
        with patch.object(ci, 'git', side_effect=['a' * 40, 'a' * 40, RuntimeError('not ancestor')]):
            with self.assertRaises(RuntimeError):
                ci.verify_source(Path('.'), 'v0.1.0-beta.10')

    def test_retry_binds_source_commit_digest_version_and_signed_bytes(self):
        record = {'tag': 'v0.1.0-beta.10', 'commit': 'a' * 40, 'sourceSha256': 'b' * 64,
                  'versionCode': 10, 'versionName': '0.1.0-beta.10', 'errorReporting': 'disabled'}
        released = {'versionCode': 10, 'versionName': record['versionName'], 'sha256': 'c' * 64,
                    'sourceSha256': record['sourceSha256'], 'apkName': 'com.wilderguard.game.beta_10.apk'}
        receipt = {**record, 'apkSha256': released['sha256'], 'apkName': released['apkName']}
        ci.validate_receipt(receipt, record, released)
        for field in ['commit', 'sourceSha256', 'versionCode', 'versionName', 'apkSha256', 'apkName']:
            with self.subTest(field=field), self.assertRaises(ValueError):
                ci.validate_receipt({**receipt, field: 'changed'}, record, released)

    def test_payload_rejects_private_or_unexpected_root_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.env').write_text('private')
            with self.assertRaises(ValueError):
                ci.install_payload(root, root / 'destination')

    def test_payload_rejects_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload = root / 'payload'
            payload.mkdir()
            (payload / 'index.html').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError):
                ci.install_payload(payload, root / 'destination')

    def test_payload_preserves_git_and_receipts(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            payload, dest = root / 'payload', root / 'dest'
            payload.mkdir()
            dest.mkdir()
            (dest / '.git').mkdir()
            (dest / 'release-receipts').mkdir()
            (dest / 'release-receipts/old.json').write_text('{}')
            (payload / 'index.html').write_text('new')
            ci.install_payload(payload, dest)
            self.assertEqual((dest / 'index.html').read_text(), 'new')
            self.assertTrue((dest / '.git').is_dir())
            self.assertTrue((dest / 'release-receipts/old.json').is_file())

    def test_existing_release_assets_must_match_exact_bytes(self):
        ci.validate_asset_hashes({'app.apk': 'abc'}, {'app.apk': 'abc'})
        for existing in [{'app.apk': 'changed'}, {'extra.map': 'source'}]:
            with self.assertRaises(ValueError):
                ci.validate_asset_hashes({'app.apk': 'abc'}, existing)

class OrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.record = {'tag': 'v0.1.0-beta.10', 'commit': 'a' * 40, 'sourceSha256': 'b' * 64,
                       'versionCode': 10, 'versionName': '0.1.0-beta.10', 'errorReporting': 'disabled'}

    def repository(self, path):
        path.mkdir()
        ci.git(path, 'init', '-b', 'main')
        ci.git(path, 'config', 'user.name', 'test')
        ci.git(path, 'config', 'user.email', 'test@example.invalid')
        return path

    def commit(self, path):
        ci.git(path, 'add', '--all')
        ci.git(path, 'commit', '-m', 'test fixture')

    def test_real_git_source_snapshot_and_dirty_untrusted_sources(self):
        repo = self.repository(self.root / 'source')
        (repo / 'android/app').mkdir(parents=True)
        (repo / 'android/app/build.gradle').write_text(
            'versionCode 10\nversionName "0.1.0"\nversionNameSuffix "-beta.10"')
        (repo / 'fdroid/metadata').mkdir(parents=True)
        (repo / 'fdroid/metadata/com.wilderguard.game.beta.yml').write_text(
            'CurrentVersion: 0.1.0-beta.10\nCurrentVersionCode: 10\n')
        self.commit(repo)
        ci.git(repo, 'tag', self.record['tag'])
        ci.git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
        actual = ci.source_record(repo, self.record['tag'])
        self.assertEqual(actual['commit'], ci.git(repo, 'rev-parse', 'HEAD'))
        self.assertEqual(len(actual['sourceSha256']), 64)
        (repo / 'android/app/build.gradle').write_text('changed')
        with self.assertRaises(RuntimeError):
            ci.source_record(repo, self.record['tag'])

    def make_distribution(self):
        dist = self.root / 'distribution'
        (dist / 'fdroid/repo').mkdir(parents=True)
        signed = dist / 'fdroid/repo/com.wilderguard.game.beta_10.apk'
        signed.write_bytes(b'signed immutable APK')
        released = {**self.record, 'apkName': signed.name, 'sha256': ci.publisher.digest(signed)}
        receipt = {**self.record, 'apkName': signed.name, 'apkSha256': released['sha256']}
        ci.write_json(dist / 'signing-certificates.json', {})
        ci.write_json(dist / 'release-manifest.json', [released])
        return dist, released, receipt

    def stage_args(self, dist):
        from types import SimpleNamespace
        apk = self.root / 'app.apk'
        apk.write_bytes(b'unsigned APK')
        build = self.root / 'build.json'
        ci.write_json(build, {**self.record, 'unsignedSha256': ci.publisher.digest(apk)})
        return SimpleNamespace(tag=self.record['tag'], build=build, apk=apk,
                               distribution=dist, assets=self.root / 'assets')

    def test_retry_reuses_signed_bytes_without_signing_or_changing_feed(self):
        dist, released, receipt = self.make_distribution()
        ci.write_json(dist / 'release-receipts/v0.1.0-beta.10.json', receipt)
        args = self.stage_args(dist)
        with patch.object(ci, 'source_record', return_value=self.record), \
             patch.object(ci, 'verify_state', return_value=[released]), \
             patch.object(ci.publisher, 'tools_paths', return_value=(Path('signer'), Path('aapt'))), \
             patch.object(ci.publisher, 'apk_metadata', return_value=(10, '0.1.0-beta.10')), \
             patch.object(ci.publisher, 'publish') as sign:
            ci.stage_release(args)
        sign.assert_not_called()
        self.assertEqual((args.assets / receipt['apkName']).read_bytes(), b'signed immutable APK')
        self.assertEqual(json.loads((args.assets / 'release-receipt.json').read_text()), receipt)

    def test_wrong_unsigned_version_stops_before_signing(self):
        dist, _, _ = self.make_distribution()
        args = self.stage_args(dist)
        with patch.object(ci, 'source_record', return_value=self.record), \
             patch.object(ci.publisher, 'tools_paths', return_value=(Path('signer'), Path('aapt'))), \
             patch.object(ci.publisher, 'apk_metadata', return_value=(11, '0.1.0-beta.11')), \
             patch.object(ci.publisher, 'publish') as sign:
            with self.assertRaises(ValueError):
                ci.stage_release(args)
        sign.assert_not_called()

    def test_artifact_substitution_stops_before_reading_signing_inputs(self):
        dist, _, _ = self.make_distribution()
        args = self.stage_args(dist)
        args.apk.write_bytes(b'tampered')
        with patch.object(ci, 'source_record', return_value=self.record), \
             patch.object(ci, 'verify_state') as verify:
            with self.assertRaises(ValueError):
                ci.stage_release(args)
        verify.assert_not_called()

    def test_new_release_stages_only_validated_output_and_writes_receipt(self):
        dist, released, receipt = self.make_distribution()
        args = self.stage_args(dist)
        previous = {**released, 'versionCode': 9}
        def publish(arguments):
            arguments.output.mkdir()
            (arguments.output / 'index.html').write_text('new landing page')
        with patch.object(ci, 'source_record', return_value=self.record), \
             patch.object(ci, 'verify_state', side_effect=[[previous], [previous, released]]), \
             patch.object(ci.publisher, 'tools_paths', return_value=(Path('signer'), Path('aapt'))), \
             patch.object(ci.publisher, 'apk_metadata', return_value=(10, '0.1.0-beta.10')), \
             patch.object(ci.publisher, 'publish', side_effect=publish):
            ci.stage_release(args)
        self.assertEqual((dist / 'index.html').read_text(), 'new landing page')
        self.assertEqual(json.loads((dist / 'release-receipts/v0.1.0-beta.10.json').read_text()), receipt)

    def test_atomic_git_push_is_idempotent_and_old_tags_are_immutable(self):
        bare = self.root / 'remote.git'
        ci.git(self.root, 'init', '--bare', str(bare))
        dist = self.repository(self.root / 'distribution')
        for name in ci.PUBLIC_ROOTS:
            if name == 'fdroid':
                (dist / name).mkdir()
                (dist / name / 'placeholder').write_text('fixture')
            else:
                (dist / name).write_text('initial')
        ci.write_json(dist / 'release-receipts/v0.1.0-beta.10.json', self.record)
        self.commit(dist)
        ci.git(dist, 'remote', 'add', 'origin', str(bare))
        ci.push_distribution(dist, self.record['tag'])
        first = ci.git(bare, 'rev-parse', 'refs/tags/v0.1.0-beta.10')
        ci.push_distribution(dist, self.record['tag'])
        self.assertEqual(ci.git(bare, 'rev-parse', 'refs/heads/main'), first)
        (dist / 'index.html').write_text('overwrite attempt')
        with self.assertRaises(ValueError):
            ci.push_distribution(dist, self.record['tag'])
        self.assertEqual(ci.git(bare, 'rev-parse', 'refs/tags/v0.1.0-beta.10'), first)

    def test_release_is_draft_until_assets_uploaded_and_retry_does_not_clobber(self):
        from types import SimpleNamespace
        dist, _, receipt = self.make_distribution()
        assets = self.root / 'assets'
        ci.export_assets(dist, receipt, assets)
        calls = []
        with patch.object(ci.subprocess, 'run', return_value=SimpleNamespace(returncode=1)), \
             patch.object(ci.publisher, 'run', side_effect=lambda command: calls.append(command) or ''):
            ci.source_release(self.record['tag'], assets)
        self.assertIn('--verify-tag', calls[0])
        self.assertIn('--draft', calls[0])
        self.assertEqual(sum('upload' in command for command in calls), 3)
        self.assertIn('--draft=false', calls[-1])
        names = [receipt['apkName'], 'SHA256SUMS', 'release-receipt.json']
        calls.clear()
        def gh(command):
            calls.append(command)
            if 'download' in command:
                name = command[command.index('--pattern') + 1]
                target = Path(command[command.index('--dir') + 1]) / name
                shutil.copy2(assets / name, target)
            return ''
        response = SimpleNamespace(returncode=0, stdout=json.dumps({'isPrerelease': True, 'assets': [{'name': name} for name in names]}))
        with patch.object(ci.subprocess, 'run', return_value=response), patch.object(ci.publisher, 'run', side_effect=gh):
            ci.source_release(self.record['tag'], assets)
        self.assertFalse(any('upload' in command for command in calls))
        self.assertFalse(any('--clobber' in command for command in calls))

    def test_pages_verifies_signed_payload_and_times_out_without_mutation(self):
        from io import BytesIO
        dist, _, receipt = self.make_distribution()
        ci.write_json(dist / 'release-receipts/v0.1.0-beta.10.json', receipt)
        for name in ['entry.jar', 'index-v1.jar', 'index-v2.json']:
            (dist / 'fdroid/repo' / name).write_bytes(name.encode())
        def response(request, **kwargs):
            relative = request.full_url.removeprefix(ci.publisher.SITE_URL + '/')
            return BytesIO((dist / relative).read_bytes())
        with patch.object(ci.urllib.request, 'urlopen', side_effect=response):
            ci.verify_pages(dist, self.record['tag'])
        with patch.object(ci.urllib.request, 'urlopen', side_effect=OSError('offline')), \
             patch.object(ci.time, 'sleep'):
            with self.assertRaises(RuntimeError):
                ci.verify_pages(dist, self.record['tag'])

class StateAndEntrypointTests(unittest.TestCase):
    def test_retained_signatures_pins_hashes_and_metadata_are_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp)
            pins = json.loads((ci.ROOT / 'fdroid/signing-certificates.json').read_text())
            ci.write_json(state / 'signing-certificates.json', pins)
            record = {'versionCode': 10, 'versionName': '0.1.0-beta.10', 'apkName': 'app.apk'}
            ci.write_json(state / 'release-manifest.json', [record])
            with patch.object(ci.publisher, 'validate_retained_files') as hashes, \
                 patch.object(ci.publisher, 'verify_indexes') as indexes, \
                 patch.object(ci.publisher, 'tools_paths', return_value=(Path('signer'), Path('aapt'))), \
                 patch.object(ci.publisher, 'verify_apk') as signatures, \
                 patch.object(ci.publisher, 'apk_metadata', return_value=(10, '0.1.0-beta.10')):
                self.assertEqual(ci.verify_state(state), [record])
                hashes.assert_called_once()
                indexes.assert_called_once()
                signatures.assert_called_once()
            (state / 'signing-certificates.json').unlink()
            (state / 'signing-certificates.json').symlink_to('/etc/passwd')
            with self.assertRaises(ValueError):
                ci.verify_state(state)

    def test_cli_routes_and_reports_guard_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            build, apk = Path(tmp) / 'build.json', Path(tmp) / 'app.apk'
            apk.write_bytes(b'unsigned')
            record = {'tag': 'v0.1.0-beta.10'}
            with patch('sys.argv', ['release_ci', 'prepare', '--tag', record['tag'], '--build', str(build), '--apk', str(apk)]), \
                 patch.object(ci, 'source_record', return_value=record):
                ci.main()
            self.assertEqual(json.loads(build.read_text())['unsignedSha256'], ci.publisher.digest(apk))
            for command, function in [('stage', 'stage_release'), ('push', 'push_distribution'),
                                      ('release', 'source_release'), ('verify-pages', 'verify_pages')]:
                with patch('sys.argv', ['release_ci', command, '--tag', record['tag'], '--distribution', tmp]), \
                     patch.object(ci, function) as handler:
                    ci.main()
                    handler.assert_called_once()
            with patch('sys.argv', ['release_ci', 'prepare', '--tag', 'bad']), \
                 patch.object(ci, 'source_record', side_effect=ValueError('guard rejected')), \
                 patch('sys.stderr'):
                with self.assertRaises(SystemExit) as error:
                    ci.main()
                self.assertEqual(error.exception.code, 1)


if __name__ == '__main__':
    unittest.main()
