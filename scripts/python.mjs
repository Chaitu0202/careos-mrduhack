#!/usr/bin/env node
/**
 * Cross-platform Python launcher for CareOS npm/bun scripts.
 *
 * Linux/macOS CI generally exposes `python3`; Windows developers commonly only
 * have the `py -3` launcher. This tiny JavaScript shim lets one package script
 * work everywhere without adding a native dependency.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);

const candidates = [];
if (process.env.CAREOS_PYTHON) {
  candidates.push(process.env.CAREOS_PYTHON.split(/\s+/).filter(Boolean));
}
if (process.platform === 'win32') {
  candidates.push(['py', '-3'], ['python'], ['python3']);
} else {
  candidates.push(['python3'], ['python'], ['py', '-3']);
}

function works(command) {
  if (!command.length) return false;
  const probe = spawnSync(command[0], [...command.slice(1), '-c', 'import sys; print(sys.version_info[0])'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  return probe.status === 0 && Number.parseInt(probe.stdout?.trim() ?? '', 10) >= 3;
}

const python = candidates.find(works);
if (!python) {
  console.error('Python 3 is required for CareOS database and analytics scripts.');
  console.error('Install Python 3 or set CAREOS_PYTHON to the interpreter command.');
  process.exit(127);
}

const result = spawnSync(python[0], [...python.slice(1), ...args], {
  cwd: REPO_ROOT,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
