import { readFileSync } from 'node:fs';

type AutoLoopSummary = {
  autoLoop: string;
  status: string;
  totalCycles: number;
};

function fail(message: string): never {
  console.error(`auto-loop-summary-parse-failed: ${message}`);
  process.exit(1);
}

const raw = readFileSync(0, 'utf8');
const lines = raw
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.length > 0);

if (lines.length === 0) {
  fail('empty stdin');
}

const lastLine = lines[lines.length - 1];

let parsed: AutoLoopSummary;
try {
  parsed = JSON.parse(lastLine) as AutoLoopSummary;
} catch {
  fail('last line is not valid JSON');
}

if (parsed.autoLoop !== 'v2') {
  fail('autoLoop must be "v2"');
}
if (parsed.status !== 'completed') {
  fail(`status must be "completed" but was "${parsed.status}"`);
}
if (!Number.isFinite(parsed.totalCycles) || parsed.totalCycles <= 0) {
  fail('totalCycles must be a positive number');
}

console.log(`auto-loop-summary-parse-ok: completedCycles=${parsed.totalCycles}`);
