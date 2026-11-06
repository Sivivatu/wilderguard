import { mkdir, readFile, readdir, rename, copyFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Private local artifacts only. This script has no upload capability.
const outputDir = process.argv[2] ?? 'dist';
const files = await readdir(`${outputDir}/assets`);
const bundles = files.filter(file => file.endsWith('.js'));
const hash = createHash('sha256');
for (const file of bundles.sort()) hash.update(await readFile(`${outputDir}/assets/${file}`));
const buildId = hash.digest('hex').slice(0, 16);
const destination = `artifacts/error-symbols/${buildId}`;
await mkdir(`${destination}/assets`, { recursive: true });
for (const file of files.filter(file => file.endsWith('.map'))) {
  const path = `${outputDir}/assets/${file}`;
  const map = JSON.parse(await readFile(path, 'utf8'));
  if (map.sourcesContent?.some(content => content != null)) throw new Error('Source content must not be embedded in error maps');
  await rename(path, `${destination}/assets/${file}`);
}
for (const file of bundles) await copyFile(`${outputDir}/assets/${file}`, `${destination}/assets/${file}`);
await writeFile(`${destination}/build.json`, JSON.stringify({ buildId, bundles }, null, 2));
process.stdout.write(`Private error maps archived to ${destination}; none remain in the web output.\n`);
