import { describe, it, expect } from 'vitest'
import { getContextHints } from './StatusBar'

describe('getContextHints', () => {
  it('returns sidebar hints when panel is sidebar regardless of screen context', () => {
    const hints = getContextHints('sidebar', 'pr-list')
    expect(hints).toContain('Enter:select')
    expect(hints).toContain('Tab:list')
  })

  it('returns sidebar hints when panel is sidebar and no context', () => {
    const hints = getContextHints('sidebar')
    expect(hints).toContain('Enter:select')
    expect(hints).toContain('?:help')
  })

  it('returns pr-list hints when context is pr-list', () => {
    const hints = getContextHints('list', 'pr-list')
    expect(hints).toContain('/:filter')
    expect(hints).toContain('s:sort')
    expect(hints).toContain('o:browser')
    expect(hints).toContain('y:copy-url')
  })

  it('returns description tab hints for pr-detail-description', () => {
    const hints = getContextHints('detail', 'pr-detail-description')
    expect(hints).toContain('1-5:tabs')
    expect(hints).toContain('R:review')
    expect(hints).toContain('m:merge')
    expect(hints).toContain('o:open')
    expect(hints).toContain('?:help')
  })

  it('returns files tab (diff panel) hints for pr-detail-files', () => {
    const hints = getContextHints('detail', 'pr-detail-files')
    expect(hints).toContain('c:comment')
    expect(hints).toContain('v:visual')
    expect(hints).toContain('d:split')
    expect(hints).toContain('/:search')
    expect(hints).toContain('Tab:tree')
  })

  it('returns files tab tree panel hints for pr-detail-files-tree', () => {
    const hints = getContextHints('detail', 'pr-detail-files-tree')
    expect(hints).toContain('Enter:view')
    expect(hints).toContain('/:filter')
    expect(hints).toContain('v:viewed')
    expect(hints).toContain('Tab:diff')
  })

  it('returns files tab diff panel hints for pr-detail-files-diff', () => {
    const hints = getContextHints('detail', 'pr-detail-files-diff')
    expect(hints).toContain('c:comment')
    expect(hints).toContain('v:visual')
    expect(hints).toContain('d:split')
    expect(hints).toContain('/:search')
    expect(hints).toContain('Tab:tree')
  })

  it('returns conversations tab hints for pr-detail-conversations', () => {
    const hints = getContextHints('detail', 'pr-detail-conversations')
    expect(hints).toContain('c:comment')
    expect(hints).toContain('r:reply')
    expect(hints).toContain('x:resolve')
    expect(hints).toContain('e:edit')
    expect(hints).toContain('f:filter')
  })

  it('returns checks tab hints for pr-detail-checks', () => {
    const hints = getContextHints('detail', 'pr-detail-checks')
    expect(hints).toContain('j/k:nav')
    expect(hints).toContain('o:open')
    expect(hints).toContain('y:copy')
  })

  it('returns commits tab hints for pr-detail-commits', () => {
    const hints = getContextHints('detail', 'pr-detail-commits')
    expect(hints).toContain('j/k:nav')
    expect(hints).toContain('y:copy-sha')
    expect(hints).toContain('R:review')
    expect(hints).toContain('m:merge')
  })

  it('returns settings hints for settings context', () => {
    const hints = getContextHints('list', 'settings')
    expect(hints).toContain('Enter:edit/toggle')
    expect(hints).toContain('Esc:cancel')
  })

  it('returns browse-picker hints for browse-picker context', () => {
    const hints = getContextHints('list', 'browse-picker')
    expect(hints).toContain('Enter:search')
    expect(hints).toContain('j/k:recent')
    expect(hints).toContain('x:remove')
    expect(hints).toContain('Esc:back')
  })

  it('returns browse-list hints for browse-list context', () => {
    const hints = getContextHints('list', 'browse-list')
    expect(hints).toContain('Enter:open')
    expect(hints).toContain('Esc:picker')
    expect(hints).toContain('/:filter')
    expect(hints).toContain('R:refresh')
  })

  it('falls back to default panel hints when no screen context', () => {
    const listHints = getContextHints('list')
    expect(listHints).toContain('Enter:detail')

    const detailHints = getContextHints('detail')
    expect(detailHints).toContain('Tab:tabs')
    expect(detailHints).toContain('Esc:list')
  })
})
