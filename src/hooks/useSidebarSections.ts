import { useState, useCallback, useMemo } from 'react'

export interface SidebarSection {
  readonly name: string
  readonly itemIndices: readonly number[] // indices into SIDEBAR_ITEMS
}

export const SIDEBAR_SECTIONS: readonly SidebarSection[] = [
  { name: 'Reviews', itemIndices: [0, 1, 2, 3] },
  { name: 'App', itemIndices: [4] },
]

export type NavigableEntry =
  | { readonly type: 'section'; readonly sectionName: string }
  | { readonly type: 'item'; readonly itemIndex: number }

export interface UseSidebarSectionsReturn {
  readonly collapsedSections: ReadonlySet<string>
  readonly toggleSection: (sectionName: string) => void
  readonly navigableEntries: readonly NavigableEntry[]
}

export function useSidebarSections(): UseSidebarSectionsReturn {
  const [collapsedSections, setCollapsedSections] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const toggleSection = useCallback((sectionName: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      return next
    })
  }, [])

  const navigableEntries = useMemo((): readonly NavigableEntry[] => {
    const entries: NavigableEntry[] = []
    for (const section of SIDEBAR_SECTIONS) {
      entries.push({ type: 'section', sectionName: section.name })
      if (!collapsedSections.has(section.name)) {
        for (const idx of section.itemIndices) {
          entries.push({ type: 'item', itemIndex: idx })
        }
      }
    }
    return entries
  }, [collapsedSections])

  return {
    collapsedSections,
    toggleSection,
    navigableEntries,
  }
}

export function getItemIndex(entry: NavigableEntry): number | null {
  return entry.type === 'item' ? entry.itemIndex : null
}
