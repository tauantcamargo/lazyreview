import React from 'react';
import { Box } from 'ink';
import type { Theme } from '../theme';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneProps {
  direction: SplitDirection;
  sizes: number[];
  width: number;
  height: number;
  theme?: Theme;
  children: React.ReactNode[];
  showDividers?: boolean;
}

export function SplitPane({
  direction,
  sizes,
  width,
  height,
  theme,
  children,
  showDividers = true,
}: SplitPaneProps): JSX.Element {
  const borderColor = theme?.border ?? 'gray';
  const childArray = React.Children.toArray(children);

  // Calculate sizes (percentages or fixed)
  const totalSize = direction === 'horizontal' ? width : height;
  const dividerCount = showDividers ? Math.max(0, childArray.length - 1) : 0;
  const availableSize = totalSize - dividerCount;

  const computedSizes = sizes.map((size) => {
    if (size <= 1) {
      // Treat as percentage
      return Math.floor(availableSize * size);
    }
    // Treat as fixed size
    return size;
  });

  // Adjust last pane to fill remaining space
  const usedSize = computedSizes.reduce((a, b) => a + b, 0);
  const lastIndex = computedSizes.length - 1;
  if (lastIndex >= 0 && usedSize < availableSize) {
    const lastSize = computedSizes[lastIndex];
    if (lastSize !== undefined) {
      computedSizes[lastIndex] = lastSize + (availableSize - usedSize);
    }
  }

  return (
    <Box
      flexDirection={direction === 'horizontal' ? 'row' : 'column'}
      width={width}
      height={height}
    >
      {childArray.map((child, index) => {
        const paneSize = computedSizes[index] ?? 0;
        const isLast = index === childArray.length - 1;

        return (
          <React.Fragment key={index}>
            <Box
              width={direction === 'horizontal' ? paneSize : width}
              height={direction === 'vertical' ? paneSize : height}
            >
              {child}
            </Box>
            {showDividers && !isLast && (
              <Box
                width={direction === 'horizontal' ? 1 : width}
                height={direction === 'vertical' ? 1 : height}
                borderStyle="single"
                borderColor={borderColor}
                borderTop={direction === 'horizontal'}
                borderBottom={direction === 'horizontal'}
                borderLeft={direction === 'vertical'}
                borderRight={direction === 'vertical'}
              />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}
