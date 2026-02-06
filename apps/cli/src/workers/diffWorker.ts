import { parentPort } from 'node:worker_threads';

parentPort?.on('message', (payload: { diff: string }) => {
  const diff = payload.diff;
  // Placeholder for heavier parsing/syntax work.
  parentPort?.postMessage({ diff });
});
