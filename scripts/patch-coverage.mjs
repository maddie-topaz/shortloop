#!/usr/bin/env node
// Global coverage thresholds miss the case that matters most for agent-authored
// changes: a large uncovered addition to an otherwise well-covered codebase
// barely moves the global number. This checks only the lines this diff adds.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';

const base = process.argv[2];
const lcovPath = process.argv[3] ?? 'backend/coverage/lcov.info';
const threshold = Number(process.argv[4] ?? 80);
const measuredPrefix = 'backend/src/';

if (!base) {
  console.error('usage: patch-coverage.mjs <base-ref> [lcov-path] [threshold]');
  process.exit(2);
}

/** Line numbers added or modified per file, from the unified diff. */
function addedLines(baseRef) {
  const diff = execFileSync(
    'git',
    ['diff', '--unified=0', '--diff-filter=AM', `${baseRef}...HEAD`, '--', measuredPrefix],
    { encoding: 'utf8' },
  );

  const byFile = new Map();
  let current = null;
  for (const line of diff.split('\n')) {
    const fileMatch = /^\+\+\+ b\/(.+)$/.exec(line);
    if (fileMatch) {
      current = fileMatch[1];
      byFile.set(current, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && current) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      for (let i = 0; i < count; i++) byFile.get(current).add(start + i);
    }
  }
  return byFile;
}

/**
 * Executable lines and their hit counts per file, from lcov.
 *
 * lcov records paths relative to the workspace jest ran in (`src/app.ts`), while
 * git reports them relative to the repo root (`backend/src/app.ts`). Normalising
 * to repo-relative is what makes the two sets comparable at all.
 */
function coverageByFile(path) {
  const workspaceRoot = dirname(dirname(path));
  const byFile = new Map();
  let current = null;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) {
      const recorded = line.slice(3).trim();
      current = isAbsolute(recorded) ? relative(process.cwd(), recorded) : join(workspaceRoot, recorded);
      byFile.set(current, new Map());
    } else if (line.startsWith('DA:') && current) {
      const [lineNo, hits] = line.slice(3).split(',').map(Number);
      byFile.get(current).set(lineNo, hits);
    }
  }
  return byFile;
}

const added = addedLines(base);
const coverage = coverageByFile(lcovPath);

let total = 0;
let covered = 0;
const misses = [];

for (const [file, lines] of added) {
  const fileCoverage = coverage.get(file);
  if (!fileCoverage) continue; // not an instrumented source file
  for (const lineNo of lines) {
    const hits = fileCoverage.get(lineNo);
    if (hits === undefined) continue; // not an executable line (blank, comment, type)
    total++;
    if (hits > 0) covered++;
    else misses.push(`${file}:${lineNo}`);
  }
}

if (total === 0) {
  console.log('Patch coverage: no executable lines changed under', measuredPrefix);
  process.exit(0);
}

const percent = (covered / total) * 100;
console.log(`Patch coverage: ${covered}/${total} lines (${percent.toFixed(1)}%), threshold ${threshold}%`);

if (misses.length > 0) {
  console.log('\nUncovered lines added by this change:');
  for (const miss of misses) console.log(`  ${miss}`);
}

if (percent < threshold) {
  console.error(`\nPatch coverage ${percent.toFixed(1)}% is below the ${threshold}% threshold.`);
  process.exit(1);
}
