import { readFileSync } from 'node:fs';

type TeamLoopSummary = {
  teamLoop: string;
  status: string;
  iteration: number;
  maxIterations: number;
  soakDurationMs: number;
  soakTickMs: number;
  lobbyLogPath: string;
  soakLogPath: string;
};

function fail(message: string): never {
  console.error(`team-loop-summary-parse-failed: ${message}`);
  process.exit(1);
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
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

let parsed: TeamLoopSummary;
try {
  parsed = JSON.parse(lastLine) as TeamLoopSummary;
} catch {
  fail('last line is not valid JSON');
}

if (parsed.teamLoop !== 'v2') {
  fail('teamLoop must be "v2"');
}
if (parsed.status !== 'pass') {
  fail(`status must be "pass" but was "${parsed.status}"`);
}
if (!isPositiveNumber(parsed.iteration)) {
  fail('iteration must be a positive number');
}
if (!isPositiveNumber(parsed.maxIterations)) {
  fail('maxIterations must be a positive number');
}
if (!isPositiveNumber(parsed.soakDurationMs)) {
  fail('soakDurationMs must be a positive number');
}
if (!isPositiveNumber(parsed.soakTickMs)) {
  fail('soakTickMs must be a positive number');
}
if (typeof parsed.lobbyLogPath !== 'string' || parsed.lobbyLogPath.length === 0) {
  fail('lobbyLogPath must be a non-empty string');
}
if (typeof parsed.soakLogPath !== 'string' || parsed.soakLogPath.length === 0) {
  fail('soakLogPath must be a non-empty string');
}

console.log(
  `team-loop-summary-parse-ok: status=${parsed.status} iteration=${parsed.iteration}/${parsed.maxIterations} soak=${parsed.soakDurationMs}ms`,
);
