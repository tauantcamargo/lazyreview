import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface Tab {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  width?: number;
  theme?: Theme;
  onChange?: (tabId: string) => void;
}

export function Tabs({
  tabs,
  activeTab,
  width,
  theme,
}: TabsProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';

  return (
    <Box width={width}>
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const isDisabled = tab.disabled;

        return (
          <Box key={tab.id}>
            {index > 0 && <Text color={mutedColor}> │ </Text>}
            <Text
              color={isDisabled ? mutedColor : isActive ? accentColor : undefined}
              bold={isActive}
              dimColor={isDisabled}
            >
              {tab.label}
            </Text>
            {tab.badge !== undefined && tab.badge > 0 && (
              <Text color={theme?.removed ?? 'red'}> ({tab.badge})</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// Tab panel container
export interface TabPanelProps {
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
}

export function TabPanel({ tabId, activeTab, children }: TabPanelProps): JSX.Element | null {
  if (tabId !== activeTab) {
    return null;
  }
  return <Box>{children}</Box>;
}
