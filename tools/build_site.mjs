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
const manifest = structuredClone(SOLID_DATA);
for (const file of manifest.files) {
  const packed = readFileSync(new URL(`assets/geometry/${file.packed.file}`, root));
  const decoded = gunzipSync(packed);
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  if (packed.length !== file.packed.bytes || hash(packed) !== file.packed.sha256 ||
      decoded.length !== file.bytes || hash(decoded) !== file.sha256) {
    throw new Error(`Invalid geometry resource: ${file.file}`);
  }
  if (decoded.length <= 25 * 1024 * 1024) {
    writeFileSync(new URL(`assets/geometry/${file.file}`, output), decoded);
  } else {
    file.parts = [];
    const chunkBytes = 16 * 1024 * 1024;
    for (let offset = 0; offset < decoded.length; offset += chunkBytes) {
      const name = `${file.file}.part-${file.parts.length + 1}`;
      file.parts.push(name);
      writeFileSync(new URL(`assets/geometry/${name}`, output), decoded.subarray(offset, offset + chunkBytes));
    }
  }
}
writeFileSync(new URL('assets/observatory-solid-data.js', output),
  `// Generated hosting metadata; geometry identities and hashes are unchanged.\nexport const SOLID_DATA=Object.freeze(${JSON.stringify(manifest)});\n`);
console.log(`Static site prepared: ${fileURLToPath(output)}`);
