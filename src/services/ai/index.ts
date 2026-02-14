/**
 * AI service factory.
 *
 * Routes to the correct adapter based on config.provider.
 * The service is completely opt-in — the app works fine without AI configured.
 */

import { AiConfigError } from '../../models/ai-errors'
import type { AiService, AiServiceConfig } from './types'
import { createAnthropicService } from './anthropic'
import { createOpenAiService } from './openai'
import { createCopilotService } from './copilot'
import { createGeminiService } from './gemini'
import { createOllamaService } from './ollama'

export { type AiService, type AiServiceConfig, type AiProviderType } from './types'
export type { AiMessage, AiResponse, AiStreamChunk, AiRequestOptions } from './types'
export {
  AiError,
  AiConfigError,
  AiNetworkError,
  AiRateLimitError,
  AiResponseError,
} from '../../models/ai-errors'
export type { AiServiceError } from '../../models/ai-errors'

/**
 * Create an AI service from configuration.
 *
 * Throws AiConfigError if the provider type is unknown.
 */
export function createAiService(config: AiServiceConfig): AiService {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropicService(config)
    case 'openai':
      return createOpenAiService(config)
    case 'copilot':
      return createCopilotService(config)
    case 'gemini':
      return createGeminiService(config)
    case 'ollama':
      return createOllamaService(config)
    case 'custom':
      return createOpenAiService(config, 'Custom')
    default:
      throw new AiConfigError({
        message: `Unknown AI provider: ${config.provider}`,
        provider: config.provider,
        field: 'provider',
      })
  }
}
