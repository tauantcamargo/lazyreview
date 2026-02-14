import { describe, it, expect } from 'vitest'
import {
  AiError,
  AiConfigError,
  AiRateLimitError,
  AiNetworkError,
  AiResponseError,
} from './ai-errors'

describe('AI Error Types', () => {
  describe('AiError', () => {
    it('should create with required fields', () => {
      const error = new AiError({ message: 'Something went wrong' })
      expect(error.message).toBe('Something went wrong')
      expect(error._tag).toBe('AiError')
    })

    it('should create with all fields', () => {
      const error = new AiError({
        message: 'API failure',
        detail: 'Connection refused',
        provider: 'openai',
        status: 500,
      })
      expect(error.message).toBe('API failure')
      expect(error.detail).toBe('Connection refused')
      expect(error.provider).toBe('openai')
      expect(error.status).toBe(500)
      expect(error._tag).toBe('AiError')
    })

    it('should be instanceof Error', () => {
      const error = new AiError({ message: 'test' })
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('AiConfigError', () => {
    it('should create with required fields', () => {
      const error = new AiConfigError({ message: 'Missing API key' })
      expect(error.message).toBe('Missing API key')
      expect(error._tag).toBe('AiConfigError')
    })

    it('should create with all fields', () => {
      const error = new AiConfigError({
        message: 'Invalid model',
        provider: 'anthropic',
        field: 'model',
      })
      expect(error.provider).toBe('anthropic')
      expect(error.field).toBe('model')
    })
  })

  describe('AiRateLimitError', () => {
    it('should create with required fields', () => {
      const error = new AiRateLimitError({
        message: 'Rate limited',
        provider: 'openai',
      })
      expect(error.message).toBe('Rate limited')
      expect(error.provider).toBe('openai')
      expect(error._tag).toBe('AiRateLimitError')
    })

    it('should create with retryAfterMs', () => {
      const error = new AiRateLimitError({
        message: 'Rate limited',
        provider: 'anthropic',
        retryAfterMs: 30000,
      })
      expect(error.retryAfterMs).toBe(30000)
    })
  })

  describe('AiNetworkError', () => {
    it('should create with required fields', () => {
      const error = new AiNetworkError({
        message: 'Network failure',
        provider: 'ollama',
      })
      expect(error.message).toBe('Network failure')
      expect(error.provider).toBe('ollama')
      expect(error._tag).toBe('AiNetworkError')
    })

    it('should preserve cause', () => {
      const cause = new TypeError('fetch failed')
      const error = new AiNetworkError({
        message: 'Network failure',
        provider: 'gemini',
        cause,
      })
      expect(error.cause).toBe(cause)
    })
  })

  describe('AiResponseError', () => {
    it('should create with required fields', () => {
      const error = new AiResponseError({
        message: 'Bad response',
        provider: 'openai',
      })
      expect(error.message).toBe('Bad response')
      expect(error.provider).toBe('openai')
      expect(error._tag).toBe('AiResponseError')
    })

    it('should create with all fields', () => {
      const error = new AiResponseError({
        message: 'Server error',
        provider: 'anthropic',
        status: 500,
        body: '{"error": "internal"}',
      })
      expect(error.status).toBe(500)
      expect(error.body).toBe('{"error": "internal"}')
    })
  })

  describe('Error discrimination', () => {
    it('should discriminate by _tag', () => {
      const errors = [
        new AiError({ message: 'a' }),
        new AiConfigError({ message: 'b' }),
        new AiRateLimitError({ message: 'c', provider: 'openai' }),
        new AiNetworkError({ message: 'd', provider: 'ollama' }),
        new AiResponseError({ message: 'e', provider: 'gemini' }),
      ]

      expect(errors.map((e) => e._tag)).toEqual([
        'AiError',
        'AiConfigError',
        'AiRateLimitError',
        'AiNetworkError',
        'AiResponseError',
      ])
    })
  })
})
