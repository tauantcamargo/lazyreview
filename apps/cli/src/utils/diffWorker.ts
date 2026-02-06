import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const LARGE_DIFF_THRESHOLD = 20000;

export async function processDiff(diff: string): Promise<string> {
  if (diff.length < LARGE_DIFF_THRESHOLD) {
    return diff;
  }

  const workerPath = join(__dirname, '..', 'workers', 'diffWorker.js');
  if (!existsSync(workerPath)) {
    return diff;
  }
  return await new Promise((resolve, reject) => {
    const worker = new Worker(workerPath);
    worker.on('message', (payload: { diff: string }) => {
      resolve(payload.diff);
      worker.terminate();
    });
    worker.on('error', (err) => {
      reject(err);
      worker.terminate();
    });
    worker.postMessage({ diff });
  });
}
