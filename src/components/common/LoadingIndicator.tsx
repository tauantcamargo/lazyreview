import React from 'react'
import { Box } from 'ink'
import { Spinner } from './Spinner'

interface LoadingIndicatorProps {
  readonly message?: string
}

export function LoadingIndicator({
  message = 'Loading...',
}: LoadingIndicatorProps): React.ReactElement {
  return (
    <Box>
      <Spinner label={message} />
    </Box>
  )
}
