import { deleteAIKey, loadConfig, readAIKey, storeAIKey } from '@lazyreview/core';

type AiProvider = 'openai' | 'anthropic' | 'ollama';

function resolveProvider(input?: string): AiProvider {
  if (input === 'openai' || input === 'anthropic' || input === 'ollama') {
    return input;
  }

  const config = loadConfig();
  if (config.ai?.provider === 'openai' || config.ai?.provider === 'anthropic' || config.ai?.provider === 'ollama') {
    return config.ai.provider;
  }

  return 'openai';
}

export async function aiLogin(provider?: string, key?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const apiKey = key ?? process.env.LAZYREVIEW_AI_API_KEY ?? '';
  if (!apiKey) {
    throw new Error('AI API key is required (use --key or LAZYREVIEW_AI_API_KEY)');
  }

  const storage = await storeAIKey(resolved, apiKey);
  console.log(`Stored ${resolved} API key (${storage})`);
}

export async function aiLogout(provider?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const storage = await deleteAIKey(resolved);
  console.log(`Removed ${resolved} API key (${storage})`);
}

export async function aiStatus(provider?: string): Promise<void> {
  const resolved = resolveProvider(provider);
  const key = await readAIKey(resolved);
  if (!key) {
    console.log(`No ${resolved} API key stored`);
    return;
  }

  console.log(`${resolved} API key present`);
}
