/**
 * Google Gemini API adapter.
 *
 * Uses native fetch to call the Gemini generateContent endpoint.
 * API key is passed as a query parameter.
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

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com'

function getEndpoint(config: AiServiceConfig): string {
  return config.endpoint ?? DEFAULT_ENDPOINT
}

/**
 * Map AiMessage roles to Gemini roles.
 * Gemini uses 'user' and 'model' (not 'assistant').
 * System messages are passed via systemInstruction.
 */
function buildGeminiContents(
  messages: readonly AiMessage[],
): readonly { readonly role: string; readonly parts: readonly { readonly text: string }[] }[] {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
}

function getSystemInstruction(
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
): { readonly parts: readonly { readonly text: string }[] } | undefined {
  const parts: string[] = []

  if (options?.systemPrompt) {
    parts.push(options.systemPrompt)
  }

  for (const msg of messages) {
    if (msg.role === 'system') {
      parts.push(msg.content)
    }
  }

  if (parts.length === 0) {
    return undefined
  }

  return { parts: [{ text: parts.join('\n\n') }] }
}

function buildRequestBody(
  config: AiServiceConfig,
  messages: readonly AiMessage[],
  options?: AiRequestOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    contents: buildGeminiContents(messages),
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? config.maxTokens,
      temperature: options?.temperature ?? config.temperature,
    },
  }

  const systemInstruction = getSystemInstruction(messages, options)
  if (systemInstruction !== undefined) {
    body['systemInstruction'] = systemInstruction
  }

  return body
}

export function createGeminiService(config: AiServiceConfig): AiService {
  const endpoint = getEndpoint(config)

  const complete = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): Effect.Effect<AiResponse, AiError | AiNetworkError | AiRateLimitError | AiResponseError> => {
    const url = `${endpoint}/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`
    const body = buildRequestBody(config, messages, options)

    return Effect.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const responseBody = await response.text().catch(() => '')

          if (response.status === 429) {
            throw new AiRateLimitError({
              message: 'Gemini rate limit exceeded',
              provider: 'gemini',
            })
          }

          throw new AiResponseError({
            message: `Gemini API error: ${response.status} ${response.statusText}`,
            provider: 'gemini',
            status: response.status,
            body: responseBody,
          })
        }

        const data = await response.json()
        return parseGeminiResponse(data, config.model)
      },
      catch: (error) => {
        if (
          error instanceof AiRateLimitError ||
          error instanceof AiResponseError
        ) {
          return error
        }
        return new AiNetworkError({
          message: `Gemini request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          provider: 'gemini',
          cause: error,
        })
      },
    })
  }

  const stream = (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ): AsyncIterable<AiStreamChunk> => {
    const url = `${endpoint}/v1beta/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`
    const body = buildRequestBody(config, messages, options)

    return {
      [Symbol.asyncIterator]() {
        let iterator: AsyncIterator<AiStreamChunk> | null = null

        return {
          async next(): Promise<IteratorResult<AiStreamChunk>> {
            if (iterator === null) {
              iterator = streamGeminiResponse(url, body)
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
    getProviderName: () => 'Google Gemini',
  }
}

function parseGeminiResponse(data: unknown, model: string): AiResponse {
  const obj = data as Record<string, unknown>
  const candidates = obj['candidates'] as readonly {
    readonly content?: {
      readonly parts?: readonly { readonly text?: string }[]
    }
  }[] | undefined

  const textParts = (candidates?.[0]?.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string')
    .map((p) => p.text as string)

  const usageMeta = obj['usageMetadata'] as {
    readonly promptTokenCount?: number
    readonly candidatesTokenCount?: number
  } | undefined

  return {
    content: textParts.join(''),
    model,
    usage:
      usageMeta?.promptTokenCount !== undefined &&
      usageMeta?.candidatesTokenCount !== undefined
        ? {
            inputTokens: usageMeta.promptTokenCount,
            outputTokens: usageMeta.candidatesTokenCount,
          }
        : undefined,
  }
}

async function* streamGeminiResponse(
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
      message: `Gemini stream error: ${response.status} ${response.statusText}`,
      provider: 'gemini',
      status: response.status,
    })
  }

  // Gemini streaming returns JSON chunks separated by newlines
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process remaining buffer
        if (buffer.trim().length > 0) {
          const chunk = tryParseGeminiChunk(buffer)
          if (chunk !== null) {
            yield chunk
          }
        }
        yield { text: '', done: true }
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines[lines.length - 1] ?? ''

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i]
        if (line === undefined || line.trim().length === 0) continue

        // SSE format: data: {json}
        const dataPrefix = 'data: '
        const jsonStr = line.startsWith(dataPrefix)
          ? line.slice(dataPrefix.length)
          : line

        const chunk = tryParseGeminiChunk(jsonStr)
        if (chunk !== null) {
          yield chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function tryParseGeminiChunk(jsonStr: string): AiStreamChunk | null {
  try {
    const parsed = JSON.parse(jsonStr) as {
      readonly candidates?: readonly {
        readonly content?: {
          readonly parts?: readonly { readonly text?: string }[]
        }
      }[]
    }

    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text === 'string') {
      return { text, done: false }
    }
  } catch {
    // Skip malformed JSON
  }
  return null
}
