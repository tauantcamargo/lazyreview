import React from 'react'
import { Box, Text, useApp, useInput } from 'ink'

interface ErrorFallbackProps {
  readonly error: Error
  readonly onRetry: () => void
}

function ErrorFallback({ error, onRetry }: ErrorFallbackProps): React.ReactElement {
  const { exit } = useApp()

  useInput((input) => {
    if (input === 'q') {
      exit()
    } else if (input === 'R') {
      onRetry()
    }
  })

  return (
    <Box
      flexDirection="column"
      paddingX={2}
      paddingY={1}
      borderStyle="round"
      borderColor="red"
    >
      <Text color="red" bold>
        Something went wrong
      </Text>
      <Box marginTop={1}>
        <Text color="white">{error.message}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press q to quit or R to retry</Text>
      </Box>
    </Box>
  )
}

interface ErrorBoundaryProps {
  readonly children: React.ReactNode
}

interface ErrorBoundaryState {
  readonly error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}
