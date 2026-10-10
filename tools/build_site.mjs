import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
cpSync(new URL('index.html', root), new URL('index.html', output));
cpSync(new URL('assets/', root), new URL('assets/', output), {
  recursive: true,
  filter: path => !path.endsWith('/.DS_Store'),
});
console.log(`Static site prepared: ${fileURLToPath(output)}`);
