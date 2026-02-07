import { deleteSecret, getSecret, storeSecret } from '@lazyreview/platform';
import type { AppConfig } from './config';

const AI_PREFIX = 'ai';

function account(provider: string): string {
  return `${AI_PREFIX}:${provider}`;
}

export async function storeAIKey(provider: string, key: string): Promise<'keychain' | 'file'> {
  return await storeSecret(account(provider), key);
}

export async function readAIKey(provider: string): Promise<string | null> {
  return await getSecret(account(provider));
}

export async function deleteAIKey(provider: string): Promise<'keychain' | 'file'> {
  return await deleteSecret(account(provider));
}

export type AIProvider = 'openai' | 'anthropic' | 'ollama';

export type AIClient = {
  summarizeDiff: (diff: string) => Promise<string>;
  reviewDiff: (diff: string) => Promise<string>;
};

const SUMMARY_SYSTEM =
  'You are an expert code reviewer. Produce a concise summary of the diff: purpose, key changes, and risk areas.';
const REVIEW_SYSTEM =
  'You are an expert code reviewer. Provide actionable review comments with severity (low/medium/high) and reasoning.';

export function createAIClient(config: AppConfig, apiKey: string | null): AIClient {
  const provider = (config.ai?.provider ?? 'openai') as AIProvider;
  const model = config.ai?.model ?? defaultModel(provider);
  const baseUrl = config.ai?.baseUrl ?? defaultBaseUrl(provider);

  if (provider !== 'ollama' && !apiKey) {
    throw new Error(`Missing API key for ${provider}`);
  }

  return {
    summarizeDiff: (diff: string) => runRequest({ provider, model, baseUrl, apiKey, mode: 'summary', diff }),
    reviewDiff: (diff: string) => runRequest({ provider, model, baseUrl, apiKey, mode: 'review', diff }),
  };
}

type RequestParams = {
  provider: AIProvider;
  model: string;
  baseUrl: string;
  apiKey: string | null;
  mode: 'summary' | 'review';
  diff: string;
};

async function runRequest(params: RequestParams): Promise<string> {
  const prompt = params.mode === 'summary' ? SUMMARY_SYSTEM : REVIEW_SYSTEM;
  const userContent = `Diff:\n${params.diff}`;

  switch (params.provider) {
    case 'openai':
      return await callOpenAI(params.baseUrl, params.apiKey ?? '', params.model, prompt, userContent);
    case 'anthropic':
      return await callAnthropic(params.baseUrl, params.apiKey ?? '', params.model, prompt, userContent);
    case 'ollama':
      return await callOllama(params.baseUrl, params.model, `${prompt}\n\n${userContent}`);
    default:
      throw new Error(`Unsupported AI provider: ${params.provider}`);
  }
}

function defaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'claude-3-sonnet-20240229';
    case 'ollama':
      return 'codellama:13b';
    default:
      return 'gpt-4o-mini';
  }
}

function defaultBaseUrl(provider: AIProvider): string {
  switch (provider) {
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'ollama':
      return 'http://localhost:11434';
    default:
      return 'https://api.openai.com/v1';
  }
}

async function callOpenAI(baseUrl: string, apiKey: string, model: string, system: string, user: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  return content?.trim() || '';
}

async function callAnthropic(baseUrl: string, apiKey: string, model: string, system: string, user: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const content = data.content?.[0]?.text;
  return content?.trim() || '';
}

async function callOllama(baseUrl: string, model: string, prompt: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { response?: string };
  return data.response?.trim() || '';
}
