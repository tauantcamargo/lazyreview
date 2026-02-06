import { LazyReviewStorage } from '@lazyreview/storage';
import { buildProviderBaseUrl, createProvider, loadConfig, readToken, type CommentInput, type ProviderType, type ReviewInput } from '@lazyreview/core';

type QueueListOptions = {
  limit: number;
};

type QueueSyncOptions = {
  limit: number;
};

type QueueEnqueueOptions = {
  type: string;
  providerType: string;
  host: string;
  owner: string;
  repo: string;
  prNumber: number;
  payload?: string;
};

export function listQueue(options: QueueListOptions): void {
  const storage = LazyReviewStorage.open();
  const items = storage.listQueuedActions(options.limit);
  storage.close();

  if (items.length === 0) {
    console.log('Queue is empty');
    return;
  }

  for (const item of items) {
    console.log(`${item.id} ${item.type} ${item.providerType} ${item.owner}/${item.repo} #${item.prNumber}`);
  }
}

export function enqueueAction(options: QueueEnqueueOptions): void {
  const storage = LazyReviewStorage.open();
  const action = storage.enqueueAction({
    type: options.type,
    providerType: options.providerType,
    host: options.host,
    owner: options.owner,
    repo: options.repo,
    prNumber: options.prNumber,
    payload: options.payload ?? null,
  });
  storage.close();

  console.log(`Queued ${action.type} (${action.id}) for ${action.owner}/${action.repo}#${action.prNumber}`);
}

export async function syncQueue(options: QueueSyncOptions): Promise<void> {
  const storage = LazyReviewStorage.open();
  const items = storage.listQueuedActions(options.limit);

  if (items.length === 0) {
    storage.close();
    console.log('Queue is empty');
    return;
  }

  const config = loadConfig();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    const providerType = item.providerType as ProviderType;
    const providerConfig = config.providers?.find((p) => p.type === providerType);
    const host = providerConfig?.host ?? item.host;
    const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(providerType, host);
    const tokenEnv = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;

    try {
      let token: string | undefined = (await readToken(providerType, host)) ?? tokenEnv ?? process.env.LAZYREVIEW_TOKEN ?? undefined;
      if (!token && providerType === 'github' && host === 'github.com') {
        token = (await readToken(providerType, 'api.github.com')) ?? undefined;
      }
      if (!token && providerType === 'bitbucket' && host === 'bitbucket.org') {
        token = (await readToken(providerType, 'api.bitbucket.org')) ?? undefined;
      }
      if (!token) {
        throw new Error(`Missing token for ${providerType}`);
      }

      const client = createProvider({ type: providerType, token, baseUrl });
      console.log(`Replaying ${item.type} ${item.owner}/${item.repo}#${item.prNumber}...`);

      if (item.type === 'comment') {
        const payload = item.payload ? (JSON.parse(item.payload) as CommentInput) : null;
        if (!payload) {
          throw new Error('Missing comment payload');
        }
        await client.createComment(item.owner, item.repo, item.prNumber, payload);
      } else if (item.type === 'approve') {
        const payload = item.payload ? (JSON.parse(item.payload) as { body?: string }) : null;
        await client.approveReview(item.owner, item.repo, item.prNumber, payload?.body);
      } else if (item.type === 'request_changes') {
        const payload = item.payload ? (JSON.parse(item.payload) as { body?: string }) : null;
        await client.requestChanges(item.owner, item.repo, item.prNumber, payload?.body);
      } else if (item.type === 'review_comment') {
        const payload = item.payload ? (JSON.parse(item.payload) as { body: string }) : null;
        if (!payload?.body) {
          throw new Error('Missing review payload');
        }
        const review: ReviewInput = { event: 'COMMENT', body: payload.body };
        await client.createReview(item.owner, item.repo, item.prNumber, review);
      } else {
        throw new Error(`Unknown action type: ${item.type}`);
      }

      storage.deleteAction(item.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      storage.recordActionFailure(item.id, message);
      console.error(`Failed to replay ${item.id}: ${message}`);
    }
  }

  storage.close();
  console.log(`Processed ${processed} action(s), ${failed} failed`);
}
