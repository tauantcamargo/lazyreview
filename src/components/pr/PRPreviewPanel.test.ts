import { describe, it, expect } from 'vitest'
import {
  PREVIEW_PANEL_MIN_TERMINAL_WIDTH,
  PREVIEW_PANEL_WIDTH_FRACTION,
} from './PRPreviewPanel'

describe('PRPreviewPanel constants', () => {
  it('has correct minimum terminal width threshold', () => {
    expect(PREVIEW_PANEL_MIN_TERMINAL_WIDTH).toBe(140)
  })

  it('has correct width fraction', () => {
    expect(PREVIEW_PANEL_WIDTH_FRACTION).toBe(0.4)
  })

  it('preview width calculation for 200 column terminal', () => {
    const terminalWidth = 200
    const previewWidth = Math.floor(terminalWidth * PREVIEW_PANEL_WIDTH_FRACTION)
    expect(previewWidth).toBe(80)
  })

  it('preview width calculation for 140 column terminal', () => {
    const terminalWidth = 140
    const previewWidth = Math.floor(terminalWidth * PREVIEW_PANEL_WIDTH_FRACTION)
    expect(previewWidth).toBe(56)
  })

  it('terminal below threshold should not show preview', () => {
    const terminalWidth = 139
    const isWide = terminalWidth >= PREVIEW_PANEL_MIN_TERMINAL_WIDTH
    expect(isWide).toBe(false)
  })

  it('terminal at threshold should show preview', () => {
    const terminalWidth = 140
    const isWide = terminalWidth >= PREVIEW_PANEL_MIN_TERMINAL_WIDTH
    expect(isWide).toBe(true)
  })
})
