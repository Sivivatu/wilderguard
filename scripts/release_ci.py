#!/usr/bin/env python3
"""Tag-release guards and recoverable publication; no signing inputs are logged."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path
from types import SimpleNamespace

import fdroid_beta as publisher

ROOT = Path(__file__).resolve().parents[1]
SOURCE_REPO = 'Sivivatu/wilderguard'
DISTRIBUTION_REPO = 'Sivivatu/wilderguard-beta'
PUBLIC_ROOTS = ('.nojekyll', 'fdroid', 'icon.png', 'index.html', 'release-manifest.json',
                'robots.txt', 'signing-certificates.json')


def git(root: Path, *args: str) -> str:
    return publisher.run(['git', '-C', str(root), *args]).strip()


def parse_tag(tag: str) -> tuple[str, int]:
    match = re.fullmatch(r'v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-beta\.([1-9]\d*))', tag)
    if not match:
        raise ValueError('Expected vX.Y.Z-beta.N with a positive numbered beta')
    return match[1], int(match[2])


def validate_versions(tag: str, gradle: str, feed: str) -> None:
    name, code = parse_tag(tag)
    wanted = [(r'\bversionCode\s+(\d+)', str(code)),
              (r'\bversionName\s+"([^"]+)"', name.split('-beta.')[0]),
              (r'\bversionNameSuffix\s+"([^"]+)"', f'-beta.{code}')]
    for pattern, expected in wanted:
        if re.findall(pattern, gradle) != [expected]:
            raise ValueError('Tag and Android version metadata differ')
    for key, expected in [('CurrentVersion', name), ('CurrentVersionCode', str(code))]:
        if re.findall(r'^' + key + r':\s*(\S+)\s*$', feed, re.M) != [expected]:
            raise ValueError('Tag and F-Droid recommended version differ')


def verify_source(root: Path, tag: str) -> str:
    parse_tag(tag)
    head = git(root, 'rev-parse', 'HEAD')
    if git(root, 'rev-parse', f'refs/tags/{tag}^{{commit}}') != head:
        raise ValueError('Tag must resolve to the checked-out source commit')
    git(root, 'merge-base', '--is-ancestor', head, 'refs/remotes/origin/main')
    git(root, 'diff', '--exit-code', 'HEAD', '--')
    return head


def snapshot_digest(files: list[tuple[str, bytes]]) -> str:
    manifest = [{'path': path, 'sha256': hashlib.sha256(content).hexdigest()}
                for path, content in sorted(files)]
    return hashlib.sha256(json.dumps(manifest, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def source_record(root: Path, tag: str) -> dict:
    commit = verify_source(root, tag)
    validate_versions(tag, (root / 'android/app/build.gradle').read_text(),
                      (root / 'fdroid/metadata/com.wilderguard.game.beta.yml').read_text())
    paths = [path for path in git(root, 'ls-files', '-z').split('\0') if path]
    if any((root / path).is_symlink() for path in paths):
        raise ValueError('Source snapshot cannot contain symlinks')
    name, code = parse_tag(tag)
    return {'tag': tag, 'commit': commit, 'versionName': name, 'versionCode': code,
            'sourceSha256': snapshot_digest([(path, (root / path).read_bytes()) for path in paths]),
            'errorReporting': 'disabled'}


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def validate_receipt(receipt: dict, build: dict, released: dict) -> None:
    expected = {key: build[key] for key in ['tag', 'commit', 'sourceSha256', 'versionCode',
                                          'versionName', 'errorReporting']}
    expected.update(apkName=released['apkName'], apkSha256=released['sha256'])
    if receipt != expected or released['sourceSha256'] != build['sourceSha256']:
        raise ValueError('Existing release receipt differs from this source or signed APK')
    if (released['versionCode'], released['versionName']) != (build['versionCode'], build['versionName']):
        raise ValueError('Release receipt version differs from retained APK')


def install_payload(payload: Path, destination: Path) -> None:
    if payload.is_symlink() or destination.is_symlink():
        raise ValueError('Publication directories cannot be symlinks')
    for path in payload.rglob('*'):
        relative = path.relative_to(payload)
        if path.is_symlink() or relative.parts[0] not in PUBLIC_ROOTS:
            raise ValueError('Unexpected or linked public payload path')
        if relative.parts[0] == 'fdroid':
            if relative.parts[:2] != ('fdroid', 'repo') and relative != Path('fdroid'):
                raise ValueError('Only fdroid/repo is public')
            if path.is_file():
                publisher.validate_public_file(path.relative_to(payload / publisher.REPO_PATH))
        elif not path.is_file() or len(relative.parts) != 1:
            raise ValueError('Public root payload must contain only regular files')
    destination.mkdir(parents=True, exist_ok=True)
    for name in PUBLIC_ROOTS:
        incoming, target = payload / name, destination / name
        if not incoming.exists():
            continue
        if target.is_symlink():
            raise ValueError('Distribution target cannot be a symlink')
        if incoming.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(incoming, target)
        else:
            shutil.copy2(incoming, target)


def verify_state(state: Path) -> list[dict]:
    for relative in ['.', 'fdroid', 'fdroid/repo', 'release-manifest.json',
                     'signing-certificates.json', 'release-receipts']:
        if (state / relative).is_symlink():
            raise ValueError('Distribution state cannot contain linked paths')
    pins = json.loads((ROOT / 'fdroid/signing-certificates.json').read_text())
    if json.loads((state / 'signing-certificates.json').read_text()) != pins:
        raise ValueError('Distribution signing identities differ from permanent pins')
    records = json.loads((state / 'release-manifest.json').read_text())
    publisher.validate_retained_files(state / publisher.REPO_PATH, records)
    publisher.verify_indexes(state / 'fdroid', pins['repoSha256'], records)
    apksigner, aapt = publisher.tools_paths()
    for record in records:
        apk = state / publisher.REPO_PATH / record['apkName']
        publisher.verify_apk(apk, apksigner, pins['apkSha256'])
        if publisher.apk_metadata(apk, aapt) != (record['versionCode'], record['versionName']):
            raise ValueError('Retained APK version differs from manifest')
    return records


def export_assets(state: Path, receipt: dict, assets: Path) -> None:
    assets.mkdir(parents=True, exist_ok=True)
    shutil.copy2(state / publisher.REPO_PATH / receipt['apkName'], assets / receipt['apkName'])
    (assets / 'SHA256SUMS').write_text(f'{receipt["apkSha256"]}  {receipt["apkName"]}\n')
    write_json(assets / 'release-receipt.json', receipt)
    (assets / 'notes.md').write_text(
        f'Wilderguard {receipt["versionName"]} (Android versionCode {receipt["versionCode"]}).\n\n'
        f'The attached signed APK is identical to the [existing F-Droid feed]({publisher.SITE_URL}/). '
        f'[Source and issues](https://github.com/{SOURCE_REPO}).\n\n'
        'Automatic error reporting is disabled in this CI build. Saves stay on the device.\n\n'
        'APK and feed signing identities remain unchanged. SHA256SUMS and the source-bound '
        'release receipt are attached. This is an early beta; physical-device validation is separate.\n')


def stage_release(args: argparse.Namespace) -> None:
    build = json.loads(args.build.read_text())
    expected = source_record(ROOT, args.tag)
    if {key: build.get(key) for key in expected} != expected:
        raise ValueError('Build provenance does not match this tagged source')
    if publisher.digest(args.apk) != build.get('unsignedSha256'):
        raise ValueError('Unsigned build artifact does not match provenance')
    _, aapt = publisher.tools_paths()
    if publisher.apk_metadata(args.apk, aapt) != (build['versionCode'], build['versionName']):
        raise ValueError('Unsigned APK version differs from the validated source tag')
    records = verify_state(args.distribution)
    receipt_path = args.distribution / 'release-receipts' / f'{args.tag}.json'
    if receipt_path.is_symlink():
        raise ValueError('Release receipt cannot be a symlink')
    if receipt_path.exists():
        receipt = json.loads(receipt_path.read_text())
        released = next(item for item in records if item['versionCode'] == build['versionCode'])
        validate_receipt(receipt, build, released)
    else:
        if build['versionCode'] <= max(item['versionCode'] for item in records):
            raise ValueError('A new CI release must increase the published versionCode')
        with tempfile.TemporaryDirectory(prefix='wilderguard-ci-') as tmp:
            state, output = Path(tmp) / 'state', Path(tmp) / 'output'
            shutil.copytree(args.distribution / 'fdroid', state / 'fdroid')
            for name in ['release-manifest.json', 'signing-certificates.json']:
                shutil.copy2(args.distribution / name, state / name)
            publisher.publish(SimpleNamespace(apk=args.apk, state=state, output=output,
                                              source_sha256=build['sourceSha256']))
            install_payload(output, args.distribution)
        released = next(item for item in verify_state(args.distribution)
                        if item['versionCode'] == build['versionCode'])
        receipt = {**expected, 'apkName': released['apkName'], 'apkSha256': released['sha256']}
        write_json(receipt_path, receipt)
    export_assets(args.distribution, receipt, args.assets)


def push_distribution(distribution: Path, tag: str) -> None:
    parse_tag(tag)
    receipt = f'release-receipts/{tag}.json'
    if not (distribution / receipt).is_file():
        raise ValueError('Cannot publish without a validated release receipt')
    git(distribution, 'add', '--', *PUBLIC_ROOTS, receipt)
    dirty = git(distribution, 'diff', '--cached', '--name-only')
    tags = git(distribution, 'tag', '--list', tag)
    if tags:
        if dirty:
            raise ValueError('Published tag is immutable; refusing changed payload')
        git(distribution, 'merge-base', '--is-ancestor', f'refs/tags/{tag}', 'HEAD')
        if git(distribution, 'show', f'refs/tags/{tag}:{receipt}') != (distribution / receipt).read_text().strip():
            raise ValueError('Published tag receipt differs from retained receipt')
        return
    if dirty:
        git(distribution, '-c', 'user.name=Wilderguard release bot', '-c',
            'user.email=41898282+github-actions[bot]@users.noreply.github.com',
            'commit', '-m', f'ci(release): publish {tag}')
    git(distribution, 'tag', tag)
    # Both refs land or neither does. Never force or overwrite an existing tag.
    git(distribution, 'push', '--atomic', 'origin', 'HEAD:refs/heads/main', f'refs/tags/{tag}')


def validate_asset_hashes(expected: dict, existing: dict) -> None:
    if set(existing) - set(expected) or any(
            name in existing and existing[name] != value for name, value in expected.items()):
        raise ValueError('Existing GitHub Release assets are immutable and differ')


def source_release(tag: str, assets: Path) -> None:
    parse_tag(tag)
    receipt = json.loads((assets / 'release-receipt.json').read_text())
    if receipt['tag'] != tag or publisher.digest(assets / receipt['apkName']) != receipt['apkSha256']:
        raise ValueError('Release assets do not match the signed receipt')
    command = ['gh', 'release', 'view', tag, '--repo', SOURCE_REPO, '--json', 'assets,isPrerelease']
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode:
        publisher.run(['gh', 'release', 'create', tag, '--repo', SOURCE_REPO, '--verify-tag',
                       '--target', receipt['commit'], '--draft', '--prerelease',
                       '--title', f'Wilderguard {receipt["versionName"]}',
                       '--notes-file', str(assets / 'notes.md')])
        existing_names = set()
    else:
        existing_release = json.loads(result.stdout)
        if not existing_release['isPrerelease']:
            raise ValueError('Beta release must remain a prerelease')
        existing_names = {asset['name'] for asset in existing_release['assets']}
    names = [receipt['apkName'], 'SHA256SUMS', 'release-receipt.json']
    if existing_names - set(names):
        raise ValueError('Unexpected existing GitHub Release assets; inspect before continuing')
    with tempfile.TemporaryDirectory(prefix='wilderguard-assets-') as tmp:
        existing = {}
        for name in names:
            if name in existing_names:
                publisher.run(['gh', 'release', 'download', tag, '--repo', SOURCE_REPO,
                               '--pattern', name, '--dir', tmp])
                existing[name] = publisher.digest(Path(tmp) / name)
        validate_asset_hashes({name: publisher.digest(assets / name) for name in names}, existing)
    for name in names:
        if name not in existing_names:
            publisher.run(['gh', 'release', 'upload', tag, str(assets / name), '--repo', SOURCE_REPO])
    publisher.run(['gh', 'release', 'edit', tag, '--repo', SOURCE_REPO, '--draft=false'])


def verify_pages(distribution: Path, tag: str) -> None:
    receipt = json.loads((distribution / 'release-receipts' / f'{tag}.json').read_text())
    paths = ['release-manifest.json', 'fdroid/repo/entry.jar', 'fdroid/repo/index-v1.jar',
             'fdroid/repo/index-v2.json', f'fdroid/repo/{receipt["apkName"]}']
    for attempt in range(20):
        try:
            for path in paths:
                request = urllib.request.Request(f'{publisher.SITE_URL}/{path}',
                                                 headers={'Cache-Control': 'no-cache'})
                with urllib.request.urlopen(request, timeout=30) as response:
                    actual = hashlib.file_digest(response, 'sha256').hexdigest()
                if actual != publisher.digest(distribution / path):
                    raise ValueError('Pages has not served the expected signed payload yet')
            print('Live Pages manifest, APK and signed indexes match the publication.')
            return
        except (OSError, ValueError):
            if attempt == 19:
                raise RuntimeError('Pages verification timed out; rerun after checking its deployment') from None
            time.sleep(15)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'stage', 'push', 'release', 'verify-pages'])
    parser.add_argument('--tag', required=True)
    parser.add_argument('--build', type=Path, default=Path('build.json'))
    parser.add_argument('--apk', type=Path)
    parser.add_argument('--distribution', type=Path)
    parser.add_argument('--assets', type=Path, default=Path('release-assets'))
    args = parser.parse_args()
    try:
        if args.command == 'prepare':
            record = source_record(ROOT, args.tag)
            if args.apk:
                record['unsignedSha256'] = publisher.digest(args.apk)
            write_json(args.build, record)
        elif args.command == 'stage':
            stage_release(args)
        elif args.command == 'push':
            push_distribution(args.distribution, args.tag)
        elif args.command == 'release':
            source_release(args.tag, args.assets)
        else:
            verify_pages(args.distribution, args.tag)
    except (ValueError, RuntimeError, OSError, KeyError, StopIteration) as error:
        # Paths and fixed guard messages only; third-party output is suppressed by publisher.run.
        parser.exit(1, f'Release stopped: {error}\n')


if __name__ == '__main__':
    main()
