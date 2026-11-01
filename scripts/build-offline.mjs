import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesIn(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]));
  return nested.flat();
}
const files = (await filesIn('dist')).filter(file => !file.endsWith('/sw.js'));
const assets = files.map(file => `/${file.slice(5)}`);
const hash = createHash('sha256').update((await Promise.all(files.map(file => readFile(file)))).map(buffer => buffer.toString('base64')).join('')).digest('hex').slice(0, 12);
const source = await readFile('public/sw.js', 'utf8');
const generated = source.replace("'wilderguard-v1'", JSON.stringify(`wilderguard-${hash}`)).replace("['/', '/icon.svg', '/manifest.webmanifest']", JSON.stringify(['/', ...assets]));
await writeFile('dist/sw.js', generated);
process.stdout.write(`Offline cache prepared: ${assets.length} bundled assets.\n`);
