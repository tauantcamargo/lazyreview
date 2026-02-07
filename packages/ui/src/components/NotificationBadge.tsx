import React from 'react';
import { Text } from 'ink';
import type { Theme } from '../theme';

export interface NotificationBadgeProps {
  count: number;
  maxDisplay?: number;
  showZero?: boolean;
  theme?: Theme;
}

export function NotificationBadge({
  count,
  maxDisplay = 99,
  showZero = false,
  theme,
}: NotificationBadgeProps): JSX.Element | null {
  if (count <= 0 && !showZero) {
    return null;
  }

  const displayCount = count > maxDisplay ? `${maxDisplay}+` : String(count);
  const bgColor = count > 0 ? (theme?.removed ?? 'red') : (theme?.muted ?? 'gray');

  return (
    <Text backgroundColor={bgColor} color="white" bold>
      {` ${displayCount} `}
    </Text>
  );
}
