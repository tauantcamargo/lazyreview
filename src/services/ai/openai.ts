/**
 * OpenAI API adapter.
 *
 * Uses native fetch to call https://api.openai.com/v1/chat/completions
 * Supports both synchronous completion and SSE streaming.
 * Also works for any OpenAI-compatible API via custom endpoint.
 */

import { Effect } from 'effect'
import {
  AiError,
  AiNetworkError,
  AiRateLimitError,
  AiResponseError,
} from '../../models/ai-errors'
import type {
  AiMessage,
  AiRequestOptions,
  AiResponse,
  AiService,
  AiServiceConfig,
  AiStreamChunk,
} from './types'
import { parseSseStream } from './sse'

const DEFAULT_ENDPOINT = 'https://api.openai.com'

function getEndpoint(config: AiServiceConfig): string {
  return config.endpoint ?? DEFAULT_ENDPOINT
}

function buildHeaders(config: AiServiceConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  }
}

function buildMessages(
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
): readonly { readonly role: string; readonly content: string }[] {
  const result: { readonly role: string; readonly content: string }[] = []

  if (options?.systemPrompt) {
    result.push({ role: 'system', content: options.systemPrompt })
  }

  for (const msg of messages) {
    result.push({ role: msg.role, content: msg.content })
  }

  return result
}

function buildRequestBody(
  config: AiServiceConfig,
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
  stream = false,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options?.maxTokens ?? config.maxTokens,
    temperature: options?.temperature ?? config.temperature,
    messages: buildMessages(messages, options),
  }

  if (stream) {
    body['stream'] = true
  }

  return body
}

export function createOpenAiService(
  config: AiServiceConfig,
  providerLabel = 'OpenAI',
): AiService {
  const endpoint = getEndpoint(config)
  const headers = buildHeaders(config)

  const complete = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): Effect.Effect<AiResponse, AiError | AiNetworkError | AiRateLimitError | AiResponseError> => {
    const url = `${endpoint}/v1/chat/completions`
    const body = buildRequestBody(config, messages, options)

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '')

          if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after')
            const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined
            throw new AiRateLimitError({
              message: `${providerLabel} rate limit exceeded`,
              provider: config.provider,
              retryAfterMs: Number.isFinite(retryMs) ? retryMs : undefined,
            })
          }

          throw new AiResponseError({
            message: `${providerLabel} API error: ${response.status} ${response.statusText}`,
            provider: config.provider,
            status: response.status,
            body: responseBody,
          })
        }

        const data = await response.json()
        return parseOpenAiResponse(data)
      },
      catch: (error) => {
        if (
          error instanceof AiRateLimitError ||
          error instanceof AiResponseError
        ) {
          return error
        }
        return new AiNetworkError({
          message: `${providerLabel} request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: config.provider,
          cause: error,
        })
      },
    })
  }

  const stream = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): AsyncIterable<AiStreamChunk> => {
    const url = `${endpoint}/v1/chat/completions`
    const body = buildRequestBody(config, messages, options, true)

    return {
      [Symbol.asyncIterator]() {
        let iterator: AsyncIterator<AiStreamChunk> | null = null

        return {
          async next(): Promise<IteratorResult<AiStreamChunk>> {
            if (iterator === null) {
              iterator = streamOpenAiResponse(url, headers, body, config.provider, providerLabel)
            }
            return iterator.next()
          },
        }
      },
    }
  }

  return {
    complete,
    stream,
    isConfigured: () => config.apiKey.length > 0 && config.model.length > 0,
    getProviderName: () => providerLabel,
  }
}

function parseOpenAiResponse(data: unknown): AiResponse {
  const obj = data as Record<string, unknown>
  const choices = obj['choices'] as readonly {
    readonly message?: { readonly content?: string }
  }[]
  const content = choices[0]?.message?.content ?? ''

  const usage = obj['usage'] as {
    readonly prompt_tokens?: number
    readonly completion_tokens?: number
  } | undefined

  return {
    content,
    model: (obj['model'] as string) ?? '',
    usage:
      usage?.prompt_tokens !== undefined && usage?.completion_tokens !== undefined
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          }
        : undefined,
  }
}

async function* streamOpenAiResponse(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  provider: string,
  providerLabel: string,
): AsyncIterator<AiStreamChunk> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok || response.body === null) {
    throw new AiResponseError({
      message: `${providerLabel} stream error: ${response.status} ${response.statusText}`,
      provider,
      status: response.status,
    })
  }

  for await (const event of parseSseStream(response.body)) {
    if (event.data === '[DONE]') {
      yield { text: '', done: true }
      return
    }

    try {
      const parsed = JSON.parse(event.data) as {
        readonly choices?: readonly {
          readonly delta?: { readonly content?: string }
          readonly finish_reason?: string | null
        }[]
      }

      const delta = parsed.choices?.[0]?.delta?.content
      const finishReason = parsed.choices?.[0]?.finish_reason

      if (typeof delta === 'string' && delta.length > 0) {
        yield { text: delta, done: false }
      }

      if (finishReason === 'stop') {
        yield { text: '', done: true }
        return
      }
    } catch {
      // Skip malformed SSE data
    }
  }
}
