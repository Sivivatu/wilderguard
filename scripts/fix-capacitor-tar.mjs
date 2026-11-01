import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const projectRoot = dirname(new URL(import.meta.url).pathname);
const cliManifestPath = require.resolve('@capacitor/cli/package.json', { paths: [projectRoot] });
const tarManifestPath = require.resolve('tar/package.json', { paths: [projectRoot] });
const cli = JSON.parse(await readFile(cliManifestPath, 'utf8'));
const tar = JSON.parse(await readFile(tarManifestPath, 'utf8'));

if (!cli.version.startsWith('6.')) {
  throw new Error(`Expected Capacitor CLI 6.x, found ${cli.version}; review its tar API before installing this compatibility patch.`);
}
if (Number(tar.version.split('.')[0]) < 7) {
  console.log(`Capacitor CLI ${cli.version} with tar ${tar.version} needs no compatibility patch.`);
  process.exit(0);
}

const templatePath = join(dirname(cliManifestPath), 'dist', 'util', 'template.js');
const before = 'await tar_1.default.extract({ file: src, cwd: dir });';
const after = 'await (tar_1.default ?? tar_1).extract({ file: src, cwd: dir });';
const template = await readFile(templatePath, 'utf8');
if (template.includes(after)) {
  console.log('Capacitor CLI tar compatibility patch is already applied.');
  process.exit(0);
}
if (!template.includes(before)) {
  throw new Error(`Could not identify the expected tar.extract call in ${templatePath}; no file was changed.`);
}
await writeFile(templatePath, template.replace(before, after));
console.log(`Patched Capacitor CLI ${cli.version} to support tar ${tar.version}'s named extract export.`);
