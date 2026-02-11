import React, { useState, useEffect } from 'react'
import { Text } from 'tuir'
import { useTheme } from '../../theme/index'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

interface SpinnerProps {
  readonly label?: string
}

export function Spinner({ label }: SpinnerProps): React.ReactElement {
  const theme = useTheme()
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length)
    }, 80)

    return () => clearInterval(timer)
  }, [])

  return (
    <Text color={theme.colors.accent}>
      {SPINNER_FRAMES[frame]} {label}
    </Text>
  )
}
