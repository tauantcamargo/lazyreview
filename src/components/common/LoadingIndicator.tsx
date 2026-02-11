import React from 'react'
import { Box } from 'tuir'
import { Spinner } from '@inkjs/ui'

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
