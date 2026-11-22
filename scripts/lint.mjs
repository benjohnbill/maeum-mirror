// Checks every tracked .js and .mjs file for syntax errors and leftover merge conflict markers.
// Run: npm run lint
import { execFileSync, spawnSync } from 'node:child_process';

const files = execFileSync('git', ['ls-files', '*.js', '*.mjs'], { encoding: 'utf8' }).split('\n').filter(Boolean);
let failed = 0;
for (const file of files) {
  const run = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (run.status !== 0) { failed++; console.error(run.stderr.trim()); }
}

const markers = spawnSync('git', ['grep', '-nE', '^(<<<<<<<|>>>>>>>)( |$)'], { encoding: 'utf8' });
if (markers.status === 0) { failed++; console.error('merge conflict markers:\n' + markers.stdout); }

console.log(`lint: ${files.length} files checked, ${failed ? failed + ' problem(s)' : 'no problems'}`);
process.exit(failed ? 1 : 0);
