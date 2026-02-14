/**
 * Anthropic API adapter.
 *
 * Uses native fetch to call https://api.anthropic.com/v1/messages
 * Supports both synchronous completion and SSE streaming.
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

const DEFAULT_ENDPOINT = 'https://api.anthropic.com'
const ANTHROPIC_VERSION = '2023-06-01'

function getEndpoint(config: AiServiceConfig): string {
  return config.endpoint ?? DEFAULT_ENDPOINT
}

function buildHeaders(config: AiServiceConfig): Record<string, string> {
  return {
    'x-api-key': config.apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'Content-Type': 'application/json',
  }
}

/**
 * Separate system messages from user/assistant messages.
 * Anthropic requires the system prompt as a top-level field, not in messages.
 */
function separateSystemPrompt(
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
): { readonly system: string | undefined; readonly messages: readonly AiMessage[] } {
  const systemMessages = messages.filter((m) => m.role === 'system')
  const nonSystemMessages = messages.filter((m) => m.role !== 'system')

  const systemParts: string[] = []
  if (options?.systemPrompt) {
    systemParts.push(options.systemPrompt)
  }
  for (const msg of systemMessages) {
    systemParts.push(msg.content)
  }

  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages: nonSystemMessages,
  }
}

function buildRequestBody(
  config: AiServiceConfig,
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
  stream = false,
): Record<string, unknown> {
  const { system, messages: filteredMessages } = separateSystemPrompt(messages, options)

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: options?.maxTokens ?? config.maxTokens,
    temperature: options?.temperature ?? config.temperature,
    messages: filteredMessages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  }

  if (system !== undefined) {
    body['system'] = system
  }

  if (stream) {
    body['stream'] = true
  }

  return body
}

export function createAnthropicService(config: AiServiceConfig): AiService {
  const endpoint = getEndpoint(config)
  const headers = buildHeaders(config)

  const complete = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): Effect.Effect<AiResponse, AiError | AiNetworkError | AiRateLimitError | AiResponseError> => {
    const url = `${endpoint}/v1/messages`
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
              message: 'Anthropic rate limit exceeded',
              provider: 'anthropic',
              retryAfterMs: Number.isFinite(retryMs) ? retryMs : undefined,
            })
          }

          throw new AiResponseError({
            message: `Anthropic API error: ${response.status} ${response.statusText}`,
            provider: 'anthropic',
            status: response.status,
            body: responseBody,
          })
        }

        const data = await response.json()
        return parseAnthropicResponse(data)
      },
      catch: (error) => {
        if (
          error instanceof AiRateLimitError ||
          error instanceof AiResponseError
        ) {
          return error
        }
        return new AiNetworkError({
          message: `Anthropic request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: 'anthropic',
          cause: error,
        })
      },
    })
  }

  const stream = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): AsyncIterable<AiStreamChunk> => {
    const url = `${endpoint}/v1/messages`
    const body = buildRequestBody(config, messages, options, true)

    return {
      [Symbol.asyncIterator]() {
        let iterator: AsyncIterator<AiStreamChunk> | null = null

        return {
          async next(): Promise<IteratorResult<AiStreamChunk>> {
            if (iterator === null) {
              iterator = streamAnthropicResponse(url, headers, body)
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
    getProviderName: () => 'Anthropic',
  }
}

function parseAnthropicResponse(data: unknown): AiResponse {
  const obj = data as Record<string, unknown>
  const content = obj['content'] as readonly { readonly type: string; readonly text?: string }[]
  const textParts = content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text as string)

  const usage = obj['usage'] as { readonly input_tokens?: number; readonly output_tokens?: number } | undefined

  return {
    content: textParts.join(''),
    model: obj['model'] as string,
    usage:
      usage?.input_tokens !== undefined && usage?.output_tokens !== undefined
        ? {
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
          }
        : undefined,
  }
}

async function* streamAnthropicResponse(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): AsyncIterator<AiStreamChunk> {
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok || response.body === null) {
    throw new AiResponseError({
      message: `Anthropic stream error: ${response.status} ${response.statusText}`,
      provider: 'anthropic',
      status: response.status,
    })
  }

  for await (const event of parseSseStream(response.body)) {
    if (event.event === 'content_block_delta') {
      try {
        const parsed = JSON.parse(event.data) as {
          readonly delta?: { readonly type: string; readonly text?: string }
        }
        if (parsed.delta?.type === 'text_delta' && typeof parsed.delta.text === 'string') {
          yield { text: parsed.delta.text, done: false }
        }
      } catch {
        // Skip malformed SSE data
      }
    } else if (event.event === 'message_stop') {
      yield { text: '', done: true }
    }
  }
}
