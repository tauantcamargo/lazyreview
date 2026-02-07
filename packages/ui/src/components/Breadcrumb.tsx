import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
  theme?: Theme;
}

export function Breadcrumb({
  items,
  separator = ' › ',
  theme,
}: BreadcrumbProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  if (items.length === 0) {
    return <Box />;
  }

  return (
    <Box>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={item.id}>
            {item.icon && (
              <Text color={isLast ? accentColor : mutedColor}>{item.icon} </Text>
            )}
            <Text color={isLast ? accentColor : mutedColor} bold={isLast}>
              {item.label}
            </Text>
            {!isLast && <Text color={mutedColor}>{separator}</Text>}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
