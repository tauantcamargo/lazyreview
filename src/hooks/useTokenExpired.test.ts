import { describe, it, expect, beforeEach } from 'vitest'
import {
  notifyTokenExpired,
  clearTokenExpired,
  isTokenExpiredSnapshot,
} from './useTokenExpired'

beforeEach(() => {
  clearTokenExpired()
})

describe('notifyTokenExpired', () => {
  it('sets the expired flag to true', () => {
    expect(isTokenExpiredSnapshot()).toBe(false)
    notifyTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(true)
  })

  it('is idempotent (duplicate calls do not stack)', () => {
    notifyTokenExpired()
    notifyTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(true)
  })
})

describe('clearTokenExpired', () => {
  it('resets the expired flag to false', () => {
    notifyTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(true)
    clearTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(false)
  })

  it('is safe to call when not expired', () => {
    clearTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(false)
  })
})

describe('expire and re-auth cycle', () => {
  it('supports full expire -> clear -> expire cycle', () => {
    expect(isTokenExpiredSnapshot()).toBe(false)
    notifyTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(true)
    clearTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(false)
    notifyTokenExpired()
    expect(isTokenExpiredSnapshot()).toBe(true)
  })
})
