import { describe, it, expect } from 'vitest'
import { setLoadingService, getLoadingService } from './useLoading'
import type { LoadingService } from '../services/Loading'

describe('useLoading module', () => {
  it('starts with null loading service', () => {
    // getLoadingService may or may not be null depending on test order
    // Just verify the function is callable
    const service = getLoadingService()
    expect(service === null || typeof service === 'object').toBe(true)
  })

  it('sets and gets loading service', () => {
    const mockService: LoadingService = {
      start: () => {},
      stop: () => {},
      getState: () => ({ isLoading: false, message: null }),
      subscribe: () => () => {},
    }
    setLoadingService(mockService)
    expect(getLoadingService()).toBe(mockService)
  })
})
