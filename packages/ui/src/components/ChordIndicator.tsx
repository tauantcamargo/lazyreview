import React from 'react';
import { Box, Text } from 'ink';

export interface ChordIndicatorProps {
  pendingKeys: string[];
  visible?: boolean;
}

/**
 * ChordIndicator - Shows pending keys in a chord sequence
 * Similar to vim's display of pending commands
 */
export function ChordIndicator({ pendingKeys, visible = true }: ChordIndicatorProps): React.ReactElement | null {
  if (!visible || pendingKeys.length === 0) {
    return null;
  }

  return (
    <Box>
      <Text color="yellow" bold>
        {pendingKeys.join('')}
      </Text>
      <Text color="gray">_</Text>
    </Box>
  );
}

export default ChordIndicator;
