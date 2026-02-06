import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface LayoutProps {
  title?: string;
  sidebarWidth?: number;
  showSidebar?: boolean;
  showDetail?: boolean;
  detailHeight?: number;
  width: number;
  height: number;
  theme?: Theme;
  sidebar?: React.ReactNode;
  main?: React.ReactNode;
  detail?: React.ReactNode;
  statusBar?: React.ReactNode;
}

export function Layout({
  title = 'LazyReview',
  sidebarWidth = 22,
  showSidebar = true,
  showDetail = true,
  detailHeight = 10,
  width,
  height,
  theme,
  sidebar,
  main,
  detail,
  statusBar,
}: LayoutProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const borderColor = theme?.border ?? 'gray';

  const actualSidebarWidth = showSidebar ? sidebarWidth : 0;
  const mainWidth = width - actualSidebarWidth;
  const statusBarHeight = statusBar ? 1 : 0;
  const headerHeight = title ? 1 : 0;
  const contentHeight = height - statusBarHeight - headerHeight;
  const mainHeight = showDetail ? contentHeight - detailHeight : contentHeight;

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header */}
      {title && (
        <Box
          width={width}
          justifyContent="center"
          borderStyle="single"
          borderColor={borderColor}
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
        >
          <Text color={accentColor} bold>
            {title}
          </Text>
        </Box>
      )}

      {/* Main Content Area */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Sidebar */}
        {showSidebar && (
          <Box
            width={actualSidebarWidth}
            height={contentHeight}
            flexDirection="column"
            borderStyle="single"
            borderColor={borderColor}
            borderTop={false}
            borderLeft={false}
            borderBottom={false}
          >
            {sidebar}
          </Box>
        )}

        {/* Main + Detail */}
        <Box width={mainWidth} flexDirection="column">
          {/* Main Panel */}
          <Box
            height={mainHeight}
            flexDirection="column"
            borderStyle="single"
            borderColor={borderColor}
            borderTop={false}
            borderLeft={showSidebar ? false : undefined}
            borderRight={false}
            borderBottom={showDetail ? undefined : false}
          >
            {main}
          </Box>

          {/* Detail Panel */}
          {showDetail && (
            <Box
              height={detailHeight}
              flexDirection="column"
              borderStyle="single"
              borderColor={borderColor}
              borderTop={false}
              borderLeft={showSidebar ? false : undefined}
              borderRight={false}
              borderBottom={false}
            >
              {detail}
            </Box>
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      {statusBar && (
        <Box width={width} height={1}>
          {statusBar}
        </Box>
      )}
    </Box>
  );
}
