/**
 * Ollama API adapter.
 *
 * Uses native fetch to call the local Ollama API.
 * Default endpoint: http://localhost:11434
 * No authentication required.
 * Supports streaming via newline-delimited JSON.
 */

import { Effect } from 'effect'
import {
  AiError,
  AiNetworkError,
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

const DEFAULT_ENDPOINT = 'http://localhost:11434'

function getEndpoint(config: AiServiceConfig): string {
  return config.endpoint ?? DEFAULT_ENDPOINT
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
  return {
    model: config.model,
    messages: buildMessages(messages, options),
    stream,
    options: {
      num_predict: options?.maxTokens ?? config.maxTokens,
      temperature: options?.temperature ?? config.temperature,
    },
  }
}

export function createOllamaService(config: AiServiceConfig): AiService {
  const endpoint = getEndpoint(config)

  const complete = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): Effect.Effect<AiResponse, AiError | AiNetworkError | AiResponseError> => {
    const url = `${endpoint}/api/chat`
    const body = buildRequestBody(config, messages, options, false)

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '')
          throw new AiResponseError({
            message: `Ollama API error: ${response.status} ${response.statusText}`,
            provider: 'ollama',
            status: response.status,
            body: responseBody,
          })
        }

        const data = await response.json()
        return parseOllamaResponse(data, config.model)
      },
      catch: (error) => {
        if (error instanceof AiResponseError) {
          return error
        }
        return new AiNetworkError({
          message: `Ollama request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: 'ollama',
          cause: error,
        })
      },
    })
  }

  const stream = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): AsyncIterable<AiStreamChunk> => {
    const url = `${endpoint}/api/chat`
    const body = buildRequestBody(config, messages, options, true)

    return {
      [Symbol.asyncIterator]() {
        let iterator: AsyncIterator<AiStreamChunk> | null = null

        return {
          async next(): Promise<IteratorResult<AiStreamChunk>> {
            if (iterator === null) {
              iterator = streamOllamaResponse(url, body)
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
    isConfigured: () => config.model.length > 0,
    getProviderName: () => 'Ollama',
  }
}

function parseOllamaResponse(data: unknown, model: string): AiResponse {
  const obj = data as Record<string, unknown>
  const message = obj['message'] as { readonly content?: string } | undefined

  const evalCount = obj['eval_count'] as number | undefined
  const promptEvalCount = obj['prompt_eval_count'] as number | undefined

  return {
    content: message?.content ?? '',
    model,
    usage:
      promptEvalCount !== undefined && evalCount !== undefined
        ? {
            inputTokens: promptEvalCount,
            outputTokens: evalCount,
          }
        : undefined,
  }
}

async function* streamOllamaResponse(
  url: string,
  body: Record<string, unknown>,
): AsyncIterator<AiStreamChunk> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok || response.body === null) {
    throw new AiResponseError({
      message: `Ollama stream error: ${response.status} ${response.statusText}`,
      provider: 'ollama',
      status: response.status,
    })
  }

  // Ollama streams newline-delimited JSON
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (buffer.trim().length > 0) {
          const chunk = tryParseOllamaChunk(buffer)
          if (chunk !== null) {
            yield chunk
          }
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines[lines.length - 1] ?? ''

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]
        if (line === undefined || line.trim().length === 0) continue

        const chunk = tryParseOllamaChunk(line)
        if (chunk !== null) {
          yield chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function tryParseOllamaChunk(jsonStr: string): AiStreamChunk | null {
  try {
    const parsed = JSON.parse(jsonStr) as {
      readonly message?: { readonly content?: string }
      readonly done?: boolean
    }

    if (parsed.done === true) {
      return { text: '', done: true }
    }

    const text = parsed.message?.content
    if (typeof text === 'string') {
      return { text, done: false }
    }
  } catch {
    // Skip malformed JSON
  }
  return null
}
