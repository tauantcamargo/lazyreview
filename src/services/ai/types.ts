import type { Effect } from 'effect'
import type { AiServiceError } from '../../models/ai-errors'

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

export type AiProviderType =
  | 'anthropic'
  | 'openai'
  | 'copilot'
  | 'gemini'
  | 'ollama'
  | 'custom'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface AiServiceConfig {
  readonly provider: AiProviderType
  readonly model: string
  readonly apiKey: string
  readonly endpoint?: string
  readonly maxTokens: number
  readonly temperature: number
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export interface AiMessage {
  readonly role: 'user' | 'assistant' | 'system'
  readonly content: string
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export interface AiResponse {
  readonly content: string
  readonly model: string
  readonly usage?: {
    readonly inputTokens: number
    readonly outputTokens: number
  }
}

export interface AiStreamChunk {
  readonly text: string
  readonly done: boolean
}

// ---------------------------------------------------------------------------
// Request options
// ---------------------------------------------------------------------------

export interface AiRequestOptions {
  readonly maxTokens?: number
  readonly temperature?: number
  readonly systemPrompt?: string
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface AiService {
  readonly complete: (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ) => Effect.Effect<AiResponse, AiServiceError>

  readonly stream: (
    messages: readonly AiMessage[],
    options?: AiRequestOptions,
  ) => AsyncIterable<AiStreamChunk>

  readonly isConfigured: () => boolean

  readonly getProviderName: () => string
}
