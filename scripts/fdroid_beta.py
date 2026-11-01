#!/usr/bin/env python3
"""Sign a Wilderguard beta and build a public, fingerprint-pinned F-Droid feed.

Run in fdroidserver==2.4.5 with eight APK_/FDROID_ signing inputs. The caller
serializes releases and retains --state. Private inputs never enter --output.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from importlib.metadata import version as installed_version
from pathlib import Path

PACKAGE = 'com.wilderguard.game.beta'
REPO_URL = 'https://sivivatu.github.io/wilderguard-beta/fdroid/repo'
SITE_URL = 'https://sivivatu.github.io/wilderguard-beta'
REPO_PATH = Path('fdroid/repo')
ROOT = Path(__file__).resolve().parents[1]
FDROID_VERSION = '2.4.5'


def normalize_fingerprint(value: str) -> str:
    normalized = value.replace(':', '').lower() if isinstance(value, str) else ''
    if not re.fullmatch(r'[a-f0-9]{64}', normalized):
        raise ValueError('Invalid pinned certificate fingerprint')
    return normalized


def validate_version(code: int, version: str) -> None:
    if type(code) is not int or code < 1 or not isinstance(version, str):
        raise ValueError('A positive integer versionCode is required')
    if not re.fullmatch(r'\d+\.\d+\.\d+-beta\.\d+', version):
        raise ValueError('Only numbered beta versions are allowed')


def merge_release(previous: list[dict], candidate: dict) -> list[dict]:
    matches = [item for item in previous if item['versionCode'] == candidate['versionCode']]
    if matches:
        if matches != [candidate]:
            raise ValueError('A published versionCode cannot change its APK or metadata')
        if candidate['versionCode'] != max(item['versionCode'] for item in previous):
            raise ValueError('Cannot republish an older release')
        return list(previous)
    if previous and candidate['versionCode'] <= max(item['versionCode'] for item in previous):
        raise ValueError('Release versionCode must increase')
    if any(item['versionName'] == candidate['versionName'] for item in previous):
        raise ValueError('A published versionName cannot be reused')
    return [*previous, candidate]


def validate_public_file(relative: Path) -> None:
    """Permit only fdroidserver public payloads, never signing/config files."""
    parts, name = relative.parts, relative.name
    if not parts or relative.is_absolute() or '..' in parts:
        raise ValueError('Unsafe repository path')
    indexes = {'index.jar', 'index.xml', 'index-v1.jar', 'index-v1.json',
               'index-v2.json', 'entry.jar', 'entry.json', 'index.html', 'index.css', 'index.png'}
    if len(parts) == 1 and (name in indexes or re.fullmatch(re.escape(PACKAGE) + r'_\d+\.apk', name)):
        return
    if parts[0] == 'diff' and len(parts) == 2 and re.fullmatch(r'\d+\.json', name):
        return
    image_root = re.fullmatch(r'icons(?:-\d+)?', parts[0]) or parts[0] == PACKAGE
    if image_root and 2 <= len(parts) <= 4 and re.fullmatch(r'[a-zA-Z0-9_.+-]+\.(png|webp|jpg|jpeg)', name):
        return
    raise ValueError('Unexpected file in public repository: ' + str(relative))


def public_files(root: Path) -> list[Path]:
    if not root.exists():
        return []
    if root.is_symlink():
        raise ValueError('Publication directories cannot be symlinks')
    files = []
    for item in root.rglob('*'):
        if item.is_symlink():
            raise ValueError('Symlinks are forbidden in publication payloads')
        if item.is_file():
            validate_public_file(item.relative_to(root))
            files.append(item)
    return files


def digest(path: Path) -> str:
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_retained_files(repo: Path, records: list[dict]) -> None:
    expected = {}
    for record in records:
        code = record['versionCode']
        validate_version(code, record['versionName'])
        if type(record.get('addedAt')) is not int or record['addedAt'] <= 0:
            raise ValueError('Invalid retained publication date')
        if not re.fullmatch(r'[a-f0-9]{64}', record.get('sourceSha256', '')):
            raise ValueError('Invalid retained source snapshot digest')
        if not re.fullmatch(r'[a-f0-9]{64}', record.get('sha256', '')):
            raise ValueError('Invalid retained APK digest')
        name = f'{PACKAGE}_{code}.apk'
        if record['apkName'] != name or code in expected:
            raise ValueError('Invalid retained release manifest')
        expected[code] = name
        apk = repo / name
        if not apk.is_file() or apk.is_symlink() or digest(apk) != record['sha256']:
            raise ValueError('Missing or altered retained APK')
    actual = {item.name for item in repo.glob('*.apk')} if repo.exists() else set()
    if actual != set(expected.values()):
        raise ValueError('Untracked APKs in retained repository')
    public_files(repo)


def run(command: list[str], *, cwd: Path | None = None) -> str:
    result = subprocess.run(command, cwd=cwd, capture_output=True, text=True)
    if result.returncode:
        # Third-party tools may echo secrets/config on error; suppress their logs.
        raise RuntimeError(f'{Path(command[0]).name} failed (exit {result.returncode}); private output suppressed')
    return result.stdout


def tools_paths() -> tuple[Path, Path]:
    sdk = Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT', ''))
    tools = sdk / 'build-tools' / '34.0.0'
    if not all((tools / name).is_file() for name in ['apksigner', 'aapt2']):
        raise ValueError('Android build-tools 34.0.0 are required via ANDROID_HOME')
    return tools / 'apksigner', tools / 'aapt2'


def apk_metadata(apk: Path, aapt: Path) -> tuple[int, str]:
    output = run([str(aapt), 'dump', 'badging', str(apk)])
    match = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", output, re.M)
    if not match or match[1] != PACKAGE:
        raise ValueError('APK package does not match this beta feed')
    if 'application-debuggable' in output:
        raise ValueError('Debuggable APKs cannot enter the beta feed')
    return int(match[2]), match[3]


def verify_apk(apk: Path, apksigner: Path, expected: str) -> None:
    output = run([str(apksigner), 'verify', '--verbose', '--print-certs', str(apk)])
    for scheme in ['v1', 'v2']:
        if not re.search(r'^Verified using ' + scheme + r' scheme[^\n]*: true$', output, re.M):
            raise ValueError('Beta APK requires both v1 and v2 signature schemes')
    matches = re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]+)$', output, re.M)
    if len(matches) != 1 or normalize_fingerprint(matches[0]) != expected:
        raise ValueError('APK signing certificate differs from the permanent pin')


def restore_keys(private: Path, pins: dict) -> tuple[Path, Path]:
    restored = []
    for prefix, pin in [('APK', 'apkSha256'), ('FDROID', 'repoSha256')]:
        for suffix in ['KEYSTORE_BASE64', 'KEYSTORE_PASSWORD', 'KEY_ALIAS', 'KEY_PASSWORD']:
            if not os.environ.get(f'{prefix}_{suffix}'):
                raise ValueError(f'Missing signing input {prefix}_{suffix}')
        path = private / (prefix.lower() + '.jks')
        path.write_bytes(base64.b64decode(os.environ[f'{prefix}_KEYSTORE_BASE64'], validate=True))
        path.chmod(0o600)
        cert = private / (prefix.lower() + '.der')
        run(['keytool', '-exportcert', '-keystore', str(path),
             '-alias', os.environ[f'{prefix}_KEY_ALIAS'],
             '-storepass:env', f'{prefix}_KEYSTORE_PASSWORD', '-file', str(cert)])
        if digest(cert) != normalize_fingerprint(pins[pin]):
            raise ValueError(f'{prefix} keystore does not match permanent fingerprint')
        restored.append(path)
    return tuple(restored)


def write_config(work: Path, repo_key: Path) -> None:
    config = {
        'repo_url': REPO_URL, 'repo_name': 'Wilderguard Beta',
        'repo_description': 'Made by Eric, a 7-year-old boy. Unlisted tower-defense beta; no accounts or ads.',
        'repo_icon': 'icon.png', 'archive_older': 0, 'make_current_version_link': False,
        'keystore': str(repo_key), 'repo_keyalias': os.environ['FDROID_KEY_ALIAS'],
        'keystorepass': {'env': 'FDROID_KEYSTORE_PASSWORD'}, 'keypass': {'env': 'FDROID_KEY_PASSWORD'},
        'sdk_path': os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT'),
    }
    path = work / 'config.yml'
    path.write_text(json.dumps(config), encoding='utf-8')
    path.chmod(0o600)


def verify_indexes(work: Path, expected: str, records: list[dict]) -> None:
    from fdroidserver import common, index
    previous_cwd = Path.cwd()
    try:
        os.chdir(work)
        common.config = {}
        common.fill_config_defaults(common.config)
        repo = work / 'repo'
        v1, _, _ = index.get_index_from_jar(str(repo / 'index-v1.jar'), expected, allow_deprecated=True)
        entry, _, _ = index.get_index_from_jar(str(repo / 'entry.jar'), expected)
        if entry['index']['sha256'] != digest(repo / 'index-v2.json'):
            raise ValueError('Signed entry does not authenticate index-v2.json')
        if set(v1['packages']) != {PACKAGE}:
            raise ValueError('Signed index must contain exactly the beta application')
        indexed = {(item['versionCode'], item['apkName'], item['hash']) for item in v1['packages'][PACKAGE]}
        wanted = {(item['versionCode'], item['apkName'], item['sha256']) for item in records}
        if indexed != wanted:
            raise ValueError('Signed index differs from immutable release manifest')
    finally:
        os.chdir(previous_cwd)


def sign_candidate(apk: Path, private: Path, app_key: Path, apksigner: Path,
                   old_repo: Path, previous: list[dict], code: int, name: str,
                   source_digest: str, app_pin: str) -> tuple[Path, dict]:
    signed = private / f'{PACKAGE}_{code}.apk'
    existing = next((item for item in previous if item['versionCode'] == code), None)
    if existing:
        if (existing['sourceSha256'], existing['versionName']) != (source_digest, name):
            raise ValueError('A published versionCode cannot be reused for different source')
        shutil.copy2(old_repo / existing['apkName'], signed)
    else:
        run([str(apksigner), 'sign', '--ks', str(app_key), '--ks-key-alias', os.environ['APK_KEY_ALIAS'],
             '--ks-pass', 'env:APK_KEYSTORE_PASSWORD', '--key-pass', 'env:APK_KEY_PASSWORD',
             '--out', str(signed), str(apk)])
    verify_apk(signed, apksigner, app_pin)
    record = {'versionCode': code, 'versionName': name, 'apkName': signed.name,
              'sha256': digest(signed), 'sourceSha256': source_digest,
              'addedAt': existing['addedAt'] if existing else int(time.time())}
    return signed, record


def build_repo(work: Path, old_repo: Path, signed: Path, records: list[dict],
               repo_key: Path, repo_pin: str) -> Path:
    repo = work / 'repo'
    if old_repo.exists():
        shutil.copytree(old_repo, repo)
    else:
        repo.mkdir()
    shutil.copy2(signed, repo / signed.name)
    for record in records:
        os.utime(repo / record['apkName'], (record['addedAt'], record['addedAt']))
    shutil.copytree(ROOT / 'fdroid/metadata', work / 'metadata')
    (repo / 'icons').mkdir(exist_ok=True)
    shutil.copy2(ROOT / 'public/icon-192.png', repo / 'icons/icon.png')
    write_config(work, repo_key)
    run(['fdroid', 'update', '--pretty', '--use-date-from-apk'], cwd=work)
    verify_indexes(work, repo_pin, records)
    if (repo / 'status').exists():
        shutil.rmtree(repo / 'status')
    validate_retained_files(repo, records)
    return repo


def render_landing(record: dict, app_pin: str, repo_pin: str, apk_size: int) -> str:
    page = (ROOT / 'fdroid/landing.html').read_text(encoding='utf-8')
    replacements = {
        '__REPO_URL__': REPO_URL, '__REPO_FINGERPRINT__': repo_pin.upper(),
        '__APK_URL__': f'{REPO_URL}/{record["apkName"]}', '__APP_FINGERPRINT__': app_pin.upper(),
        '__VERSION__': record['versionName'], '__APK_SHA256__': record['sha256'],
        '__APK_SIZE__': f'{apk_size / (1024 * 1024):.1f} MB',
    }
    for placeholder, value in replacements.items():
        page = page.replace(placeholder, html.escape(str(value), quote=True))
    if re.search(r'__[A-Z_]+__', page):
        raise ValueError('An install-page placeholder was not replaced')
    return page


def write_public_payload(private: Path, repo: Path, page: str,
                         records: list[dict], output: Path, state: Path) -> None:
    (repo / 'index.html').write_text(page, encoding='utf-8')
    public_files(repo)
    staging = private / 'public'
    shutil.copytree(repo, staging / REPO_PATH)
    (staging / 'index.html').write_text(page, encoding='utf-8')
    (staging / '.nojekyll').touch()
    (staging / 'robots.txt').write_text('User-agent: *\nDisallow: /\n', encoding='utf-8')
    (staging / 'release-manifest.json').write_text(json.dumps(records, indent=2) + '\n')
    shutil.copy2(ROOT / 'fdroid/signing-certificates.json', staging / 'signing-certificates.json')
    shutil.copy2(ROOT / 'public/icon-192.png', staging / 'icon.png')
    if output.exists():
        output.rmdir()  # Already checked empty before any signing work.
    shutil.copytree(staging, output)
    state.mkdir(parents=True, exist_ok=True)
    target = state / REPO_PATH
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(repo, target)
    for name in ['index.html', '.nojekyll', 'robots.txt', 'release-manifest.json', 'signing-certificates.json', 'icon.png']:
        shutil.copy2(staging / name, state / name)


def publication_paths(args: argparse.Namespace) -> tuple[Path, Path, Path]:
    for path in [args.state, args.output, args.apk]:
        if path.is_symlink():
            raise ValueError('Publication inputs cannot be symlinks')
    state, output, apk = args.state.resolve(), args.output.resolve(), args.apk.resolve()
    if output == state or output in state.parents or state in output.parents:
        raise ValueError('Public output and persistent state must be separate directories')
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        raise ValueError('Output directory must be empty')
    if not re.fullmatch(r'[a-f0-9]{64}', args.source_sha256):
        raise ValueError('A full SHA-256 source snapshot digest is required')
    if not apk.is_file():
        raise ValueError('Unsigned beta APK does not exist')
    return state, output, apk


def publish(args: argparse.Namespace) -> None:
    state, output, apk = publication_paths(args)
    if installed_version('fdroidserver') != FDROID_VERSION:
        raise ValueError(f'This publisher requires fdroidserver=={FDROID_VERSION}')
    pins = json.loads((ROOT / 'fdroid/signing-certificates.json').read_text())
    app_pin, repo_pin = normalize_fingerprint(pins['apkSha256']), normalize_fingerprint(pins['repoSha256'])
    apksigner, aapt = tools_paths()
    code, name = apk_metadata(apk, aapt)
    validate_version(code, name)
    manifest = state / 'release-manifest.json'
    previous = json.loads(manifest.read_text()) if manifest.exists() else []
    old_repo = state / REPO_PATH
    validate_retained_files(old_repo, previous)
    if previous:
        retained_pins = state / 'signing-certificates.json'
        if retained_pins.is_symlink() or not retained_pins.is_file():
            raise ValueError('Retained certificate pins are required for updates')
        if json.loads(retained_pins.read_text()) != pins:
            raise ValueError('Published signing identities must not change')
        verify_indexes(old_repo.parent, repo_pin, previous)
    for record in previous:
        retained = old_repo / record['apkName']
        verify_apk(retained, apksigner, app_pin)
        if apk_metadata(retained, aapt) != (record['versionCode'], record['versionName']):
            raise ValueError('Retained APK metadata differs from manifest')
    with tempfile.TemporaryDirectory(prefix='wilderguard-signing-') as tmp:
        private = Path(tmp)
        private.chmod(0o700)
        app_key, repo_key = restore_keys(private, pins)
        signed, candidate = sign_candidate(apk, private, app_key, apksigner, old_repo,
                                           previous, code, name, args.source_sha256, app_pin)
        records = merge_release(previous, candidate)
        work = private / 'work'
        work.mkdir()
        repo = build_repo(work, old_repo, signed, records, repo_key, repo_pin)
        page = render_landing(candidate, app_pin, repo_pin, signed.stat().st_size)
        write_public_payload(private, repo, page, records, output, state)
    print(f'Validated {name} ({code}); retained {len(records)} signed release(s).')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apk', required=True, type=Path)
    parser.add_argument('--state', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--source-sha256', required=True)
    args = parser.parse_args()
    try:
        publish(args)
    except (ValueError, RuntimeError, OSError) as error:
        parser.exit(1, f'Publication stopped: {error}\n')


if __name__ == '__main__':
    main()
