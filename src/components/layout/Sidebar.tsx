import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import type { SidebarCounts } from '../../hooks/useSidebarCounts'
import { SIDEBAR_SECTIONS } from '../../hooks/useSidebarSections'
import type { NavigableEntry } from '../../hooks/useSidebarSections'

export const SIDEBAR_ITEMS = [
  'Involved',
  'My PRs',
  'For Review',
  'This Repo',
  'Browse',
  'Team',
  'Settings',
] as const

export type SidebarItem = (typeof SIDEBAR_ITEMS)[number]

/**
 * Sidebar display mode:
 * - 'full': show icons + full labels
 * - 'icon-only': show only first character of label + icon (~8 cols)
 * - 'hidden': sidebar is not rendered
 */
export type SidebarMode = 'full' | 'icon-only' | 'hidden'

/**
 * Width for icon-only sidebar mode.
 */
export const SIDEBAR_ICON_ONLY_WIDTH = 8

/**
 * Cycle sidebar mode: full -> icon-only -> hidden -> full
 */
export function cycleSidebarMode(current: SidebarMode): SidebarMode {
  switch (current) {
    case 'full':
      return 'icon-only'
    case 'icon-only':
      return 'hidden'
    case 'hidden':
      return 'full'
  }
}

const sidebarIcons: Record<SidebarItem, string> = {
  Involved: '◆',
  'My PRs': '●',
  'For Review': '◎',
  'This Repo': '◈',
  Browse: '◇',
  Team: '◉',
  Settings: '⚙',
}

function getCountForItem(
  label: SidebarItem,
  counts: SidebarCounts | undefined,
): number | null {
  if (!counts) return null
  switch (label) {
    case 'Involved':
      return counts.involved
    case 'My PRs':
      return counts.myPrs
    case 'For Review':
      return counts.forReview
    case 'This Repo':
      return counts.thisRepo
    case 'Browse':
      return counts.browse
    case 'Team':
      return counts.team
    case 'Settings':
      return null
  }
}

function getUnreadForItem(
  label: SidebarItem,
  counts: SidebarCounts | undefined,
): number | null {
  if (!counts) return null
  if (label === 'For Review') return counts.forReviewUnread
  return null
}

interface SidebarProps {
  readonly selectedIndex: number
  readonly visible: boolean
  readonly isActive: boolean
  readonly counts?: SidebarCounts
  readonly collapsedSections?: ReadonlySet<string>
  readonly navigableEntries?: readonly NavigableEntry[]
  readonly navIndex?: number
  readonly mode?: SidebarMode
  readonly width?: number
}

export function Sidebar({
  selectedIndex,
  visible,
  isActive,
  counts,
  collapsedSections,
  navigableEntries,
  navIndex,
  mode = 'full',
  width = 40,
}: SidebarProps): React.ReactElement | null {
  const theme = useTheme()

  if (!visible || mode === 'hidden') return null

  if (mode === 'icon-only') {
    return renderIconOnly(selectedIndex, isActive, theme, counts)
  }

  // Determine if we're in section mode or legacy mode
  const hasSections =
    collapsedSections !== undefined && navigableEntries !== undefined

  // Determine which entry is currently highlighted in navigable list
  const currentNavEntry =
    hasSections && navIndex !== undefined
      ? navigableEntries[navIndex]
      : undefined

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor={isActive ? theme.colors.accent : theme.colors.border}
    >
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.colors.accent} bold={isActive} dimColor={!isActive}>
          Navigation
        </Text>
      </Box>
      <Box flexDirection="column" paddingTop={1}>
        {hasSections
          ? renderSections(
              collapsedSections,
              selectedIndex,
              isActive,
              theme,
              counts,
              currentNavEntry,
            )
          : renderFlatItems(selectedIndex, isActive, theme, counts)}
      </Box>
    </Box>
  )
}

function renderIconOnly(
  selectedIndex: number,
  isActive: boolean,
  theme: ReturnType<typeof useTheme>,
  counts: SidebarCounts | undefined,
): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      width={SIDEBAR_ICON_ONLY_WIDTH}
      borderStyle="single"
      borderColor={isActive ? theme.colors.accent : theme.colors.border}
    >
      <Box paddingX={1} paddingY={0}>
        <Text color={theme.colors.accent} bold={isActive} dimColor={!isActive}>
          Nav
        </Text>
      </Box>
      <Box flexDirection="column" paddingTop={1}>
        {SIDEBAR_ITEMS.map((label, index) => {
          const isSelected = index === selectedIndex
          const icon = sidebarIcons[label]
          const count = getCountForItem(label, counts)
          const abbrev = label[0] ?? ''
          return (
            <Box key={label} paddingX={0} marginLeft={1}>
              <Text
                color={isSelected ? theme.colors.accent : theme.colors.text}
                backgroundColor={isSelected ? theme.colors.selection : undefined}
                bold={isSelected}
                dimColor={!isActive && !isSelected}
              >
                {icon}{abbrev}
              </Text>
              {count !== null && count > 0 && (
                <Text color={theme.colors.muted} dimColor={!isActive}>
                  {count}
                </Text>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

function renderSections(
  collapsedSections: ReadonlySet<string>,
  selectedItemIndex: number,
  isActive: boolean,
  theme: ReturnType<typeof useTheme>,
  counts: SidebarCounts | undefined,
  currentNavEntry: NavigableEntry | undefined,
): React.ReactElement[] {
  const elements: React.ReactElement[] = []

  for (const section of SIDEBAR_SECTIONS) {
    const isCollapsed = collapsedSections.has(section.name)
    const isSectionSelected =
      currentNavEntry?.type === 'section' &&
      currentNavEntry.sectionName === section.name

    // Section header
    elements.push(
      <Box key={`section-${section.name}`} paddingX={1}>
        <Text
          color={
            isSectionSelected ? theme.colors.accent : theme.colors.secondary
          }
          bold
          backgroundColor={
            isSectionSelected ? theme.colors.selection : undefined
          }
        >
          {isSectionSelected ? '▸ ' : '  '}
          {isCollapsed ? '▸' : '▾'} {section.name}
        </Text>
      </Box>,
    )

    // Section items (only when expanded)
    if (!isCollapsed) {
      for (const idx of section.itemIndices) {
        const label = SIDEBAR_ITEMS[idx]
        if (!label) continue
        const isSelected =
          currentNavEntry?.type === 'item' && currentNavEntry.itemIndex === idx
        const icon = sidebarIcons[label]
        const count = getCountForItem(label, counts)
        const unread = getUnreadForItem(label, counts)

        elements.push(
          <Box key={label} paddingX={1} marginLeft={1}>
            <Text
              color={isSelected ? theme.colors.accent : theme.colors.text}
              backgroundColor={isSelected ? theme.colors.selection : undefined}
              bold={isSelected}
              dimColor={!isActive && !isSelected}
            >
              {isSelected ? '▸ ' : '  '}
              {icon} {label}
            </Text>
            {count !== null && (
              <Text color={theme.colors.muted}> ({count})</Text>
            )}
            {unread !== null && (
              <Text color={theme.colors.accent}> *{unread} new*</Text>
            )}
          </Box>,
        )
      }
    }
  }

  return elements
}

function renderFlatItems(
  selectedIndex: number,
  isActive: boolean,
  theme: ReturnType<typeof useTheme>,
  counts: SidebarCounts | undefined,
): React.ReactElement[] {
  return SIDEBAR_ITEMS.map((label, index) => {
    const isSelected = index === selectedIndex
    const icon = sidebarIcons[label]
    const count = getCountForItem(label, counts)
    const unread = getUnreadForItem(label, counts)
    return (
      <Box key={label} paddingX={1}>
        <Text
          color={isSelected ? theme.colors.accent : theme.colors.text}
          backgroundColor={isSelected ? theme.colors.selection : undefined}
          bold={isSelected}
          dimColor={!isActive && !isSelected}
        >
          {isSelected ? '▸ ' : '  '}
          {icon} {label}
        </Text>
        {count !== null && <Text color={theme.colors.muted}> ({count})</Text>}
        {unread !== null && (
          <Text color={theme.colors.accent}> *{unread} new*</Text>
        )}
      </Box>
    )
  })
}
