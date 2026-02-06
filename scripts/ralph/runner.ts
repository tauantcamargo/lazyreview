#!/usr/bin/env bun

import { spawn } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const promptPath = join(scriptDir, 'prompt.md');

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    'max-iterations': { type: 'string', default: '100' },
    prompt: { type: 'string' },
  },
});

async function runRalph() {
  const baselinePrompt = await Bun.file(promptPath).text();

  const prompt = values.prompt
    ? `${values.prompt}\n\n---\n\n${baselinePrompt}`
    : baselinePrompt;

  const maxIterations = values['max-iterations'] || '100';

  const escapedPrompt = prompt.replace(/'/g, "'\\''");

  const ralphCommand = `/ralph-loop:ralph-loop '${escapedPrompt}' --completion-promise "FINISHED" --max-iterations ${maxIterations}`;

  console.log('[runner] Starting Ralph loop via Claude Code plugin...\n');
  console.log(`[runner] Max iterations: ${maxIterations}\n`);

  const proc = spawn({
    cmd: [
      'sh',
      '-c',
      `claude --permission-mode bypassPermissions --verbose '${ralphCommand.replace(/'/g, "'\\''")}'`,
    ],
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  });

  await proc.exited;

  const exitCode = proc.exitCode ?? 0;
  if (exitCode === 0) {
    console.log('\n[runner] Ralph loop completed successfully!');
  } else {
    console.log(`\n[runner] Ralph loop exited with code ${exitCode}`);
  }

  process.exit(exitCode);
}

runRalph().catch((err) => {
  console.error('[runner] Error:', err);
  process.exit(1);
});
