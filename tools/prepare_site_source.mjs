import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = process.argv[2];
if (!target || !path.isAbsolute(target) || existsSync(target)) {
  throw new Error('Provide a new absolute directory for the Sites source.');
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
if (execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()) {
  throw new Error('Commit the release before preparing Sites source.');
}
mkdirSync(target, { recursive: true });
for (const item of ['index.html', 'assets', '.openai/hosting.json', 'tools/build_site.mjs']) {
  const destination = path.join(target, item);
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(path.join(root, item), destination, {
    recursive: true,
    filter: filename => !filename.endsWith('/.DS_Store') && !filename.endsWith('.bin'),
  });
}
writeFileSync(path.join(target, '.gitignore'), 'dist/\n');
writeFileSync(path.join(target, 'package.json'), `${JSON.stringify({
  name: 'universe-os-site', private: true, type: 'module',
  scripts: { 'build:site': 'node tools/build_site.mjs' },
}, null, 2)}\n`);
writeFileSync(path.join(target, '.openai/release.json'), `${JSON.stringify({
  source_commit: commit,
  geometry_transport: 'gzip-with-verified-raw-shards',
}, null, 2)}\n`);
console.log(JSON.stringify({ source_commit: commit, checkout_path: target }));
