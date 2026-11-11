import { readFile } from 'node:fs/promises';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';

const [mapPath, lineText, columnText] = process.argv.slice(2);
const line = Number(lineText);
const column = Number(columnText);
if (!mapPath || !Number.isSafeInteger(line) || line < 1 || !Number.isSafeInteger(column) || column < 1) {
  throw new Error('Usage: npm run errors:symbolicate -- <local.js.map> <line> <column> (stack positions are 1-based)');
}
const map = new TraceMap(JSON.parse(await readFile(mapPath, 'utf8')));
process.stdout.write(`${JSON.stringify(originalPositionFor(map, { line, column: column - 1 }), null, 2)}\n`);
