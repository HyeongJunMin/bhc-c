import { readFileSync } from 'node:fs';

type TestAgentSummary = {
  testAgent: string;
  status: string;
  stage: string;
  lobbyLogPath: string;
  soakLogPath: string;
  soakErrorCount: number;
  soakDurationMs: number;
  soakTickMs: number;
};

function fail(message: string): never {
  console.error(`test-agent-summary-parse-failed: ${message}`);
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

let parsed: TestAgentSummary;
try {
  parsed = JSON.parse(lastLine) as TestAgentSummary;
} catch {
  fail('last line is not valid JSON');
}

if (parsed.testAgent !== 'v2') {
  fail('testAgent must be "v2"');
}
if (parsed.status !== 'pass') {
  fail(`status must be "pass" but was "${parsed.status}"`);
}
if (parsed.soakErrorCount !== 0) {
  fail(`soakErrorCount must be 0 but was ${parsed.soakErrorCount}`);
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
  `test-agent-summary-parse-ok: status=${parsed.status} stage=${parsed.stage} soakErrors=${parsed.soakErrorCount}`,
);
