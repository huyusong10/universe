import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { SOLID_DATA } from '../assets/observatory-solid-data.js';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(new URL('index.html', root), new URL('index.html', output));
cpSync(new URL('assets/', root), new URL('assets/', output), {
  recursive: true,
  filter: path => !path.endsWith('/.DS_Store') && !path.endsWith('.bin'),
});
const headers = [];
for (const file of SOLID_DATA.files) {
  const packed = readFileSync(new URL(`assets/geometry/${file.packed.file}`, root));
  const decoded = gunzipSync(packed);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (packed.length !== file.packed.bytes || hash(packed) !== file.packed.sha256 ||
      decoded.length !== file.bytes || hash(decoded) !== file.sha256) {
    throw new Error(`Invalid geometry resource: ${file.file}`);
  }
  // HTTP decoding retains the raw endpoint for browsers without stream decoding.
  writeFileSync(new URL(`assets/geometry/${file.file}`, output), packed);
  headers.push(`/assets/geometry/${file.file}\n  Content-Encoding: gzip\n  Content-Type: application/octet-stream`);
}
writeFileSync(new URL('_headers', output), `${headers.join('\n\n')}\n`);
console.log(`Static site prepared: ${fileURLToPath(output)}`);
