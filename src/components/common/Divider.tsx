import React from 'react'
import { Box, Text, useStdout } from 'ink'
import { useTheme } from '../../theme/index'

type DividerStyle = 'single' | 'double' | 'thick' | 'dotted'
type TitleAlign = 'left' | 'center' | 'right'

const STYLE_CHARS: Record<DividerStyle, string> = {
  single: '─',
  double: '═',
  thick: '━',
  dotted: '·',
}

interface DividerProps {
  readonly title?: string
  readonly style?: DividerStyle
  readonly titleAlign?: TitleAlign
}

export function Divider({
  title,
  style = 'single',
  titleAlign = 'center',
}: DividerProps): React.ReactElement {
  const theme = useTheme()
  const { stdout } = useStdout()
  const cols = stdout?.columns ?? 80
  const len = Math.max(10, cols - 4)
  const char = STYLE_CHARS[style]

  if (title) {
    const titleWithSpace = ` ${title} `
    const pad = Math.max(0, len - titleWithSpace.length)
    let left: number
    let right: number

    if (titleAlign === 'left') {
      left = 0
      right = pad
    } else if (titleAlign === 'right') {
      left = pad
      right = 0
    } else {
      left = Math.floor(pad / 2)
      right = pad - left
    }

    const text = char.repeat(left) + titleWithSpace + char.repeat(right)
    return (
      <Box paddingY={0}>
        <Text color={theme.colors.border}>{text}</Text>
      </Box>
    )
  }

  const line = char.repeat(len)
  return (
    <Box paddingY={0}>
      <Text color={theme.colors.border}>{line}</Text>
    </Box>
  )
}
