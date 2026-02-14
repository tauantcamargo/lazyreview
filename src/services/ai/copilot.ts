/**
 * GitHub Copilot adapter.
 *
 * Uses the OpenAI-compatible API at https://api.githubcopilot.com
 * Delegates to the OpenAI adapter with a custom endpoint and GitHub token auth.
 */

import type { AiService, AiServiceConfig } from './types'
import { createOpenAiService } from './openai'

const COPILOT_ENDPOINT = 'https://api.githubcopilot.com'

export function createCopilotService(config: AiServiceConfig): AiService {
  const copilotConfig: AiServiceConfig = {
    ...config,
    endpoint: config.endpoint ?? COPILOT_ENDPOINT,
  }

  return createOpenAiService(copilotConfig, 'GitHub Copilot')
}
