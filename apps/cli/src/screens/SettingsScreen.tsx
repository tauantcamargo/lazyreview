import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import {
  Toggle,
  Select,
  RadioGroup,
  Section,
  Panel,
  KeyHint,
} from '@lazyreview/ui';
import { useAppStore } from '../stores/app-store.js';
import { useConfig } from '../hooks/index.js';
import type { UIConfig } from '../hooks/use-config.js';

export interface SettingsScreenProps {
  width?: number;
  height?: number;
}

type SettingsSection = 'ui' | 'keybindings' | 'providers' | 'performance';

interface SettingItem {
  id: string;
  label: string;
  type: 'toggle' | 'select' | 'radio';
  value: unknown;
  options?: Array<{ label: string; value: string }>;
}

/**
 * Settings Screen - Application configuration
 */
export function SettingsScreen({ width = 80, height = 20 }: SettingsScreenProps): React.ReactElement {
  const setView = useAppStore((s) => s.setView);
  const { config, setUIConfig, resetToDefaults } = useConfig();

  const [activeSection, setActiveSection] = useState<SettingsSection>('ui');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define settings sections
  const sections: Array<{ id: SettingsSection; label: string }> = [
    { id: 'ui', label: 'UI Settings' },
    { id: 'keybindings', label: 'Keybindings' },
    { id: 'providers', label: 'Providers' },
    { id: 'performance', label: 'Performance' },
  ];

  // Get settings for current section
  const getSectionSettings = (section: SettingsSection): SettingItem[] => {
    switch (section) {
      case 'ui':
        return [
          {
            id: 'theme',
            label: 'Theme',
            type: 'radio',
            value: config.ui.theme,
            options: [
              { label: 'Auto', value: 'auto' },
              { label: 'Dark', value: 'dark' },
              { label: 'Light', value: 'light' },
            ],
          },
          {
            id: 'vimMode',
            label: 'Vim Mode',
            type: 'toggle',
            value: config.ui.vimMode,
          },
          {
            id: 'showIcons',
            label: 'Show Icons',
            type: 'toggle',
            value: config.ui.showIcons,
          },
          {
            id: 'compactMode',
            label: 'Compact Mode',
            type: 'toggle',
            value: config.ui.compactMode,
          },
          {
            id: 'showLineNumbers',
            label: 'Show Line Numbers',
            type: 'toggle',
            value: config.ui.showLineNumbers,
          },
          {
            id: 'diffStyle',
            label: 'Diff Style',
            type: 'radio',
            value: config.ui.diffStyle,
            options: [
              { label: 'Unified', value: 'unified' },
              { label: 'Split', value: 'split' },
            ],
          },
          {
            id: 'syntaxHighlight',
            label: 'Syntax Highlighting',
            type: 'toggle',
            value: config.ui.syntaxHighlight,
          },
        ];

      case 'keybindings':
        return [
          { id: 'nav-up', label: 'Navigate Up', type: 'select', value: config.keybindings.navigation.up },
          { id: 'nav-down', label: 'Navigate Down', type: 'select', value: config.keybindings.navigation.down },
          { id: 'nav-left', label: 'Navigate Left', type: 'select', value: config.keybindings.navigation.left },
          { id: 'nav-right', label: 'Navigate Right', type: 'select', value: config.keybindings.navigation.right },
          { id: 'select', label: 'Select', type: 'select', value: config.keybindings.actions.select },
          { id: 'back', label: 'Back', type: 'select', value: config.keybindings.actions.back },
        ];

      case 'providers':
        return config.providers.map((provider) => ({
          id: provider.name,
          label: `${provider.name} (${provider.type})`,
          type: 'toggle' as const,
          value: provider.default,
        }));

      case 'performance':
        return [
          {
            id: 'cacheTtl',
            label: 'Cache TTL (seconds)',
            type: 'select',
            value: String(config.performance.cacheTtl),
            options: [
              { label: '60', value: '60' },
              { label: '120', value: '120' },
              { label: '300', value: '300' },
              { label: '600', value: '600' },
            ],
          },
          {
            id: 'maxConcurrency',
            label: 'Max Concurrency',
            type: 'select',
            value: String(config.performance.maxConcurrency),
            options: [
              { label: '3', value: '3' },
              { label: '6', value: '6' },
              { label: '10', value: '10' },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const currentSettings = getSectionSettings(activeSection);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || input === 'q') {
      setView('list');
      return;
    }

    // Section navigation
    if (key.tab) {
      const currentIdx = sections.findIndex((s) => s.id === activeSection);
      const nextIdx = (currentIdx + 1) % sections.length;
      setActiveSection(sections[nextIdx].id);
      setSelectedIndex(0);
      return;
    }

    // Setting navigation
    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(currentSettings.length - 1, selectedIndex + 1));
    }

    // Toggle/change setting
    if (key.return || input === ' ') {
      const setting = currentSettings[selectedIndex];
      if (setting && setting.type === 'toggle') {
        handleToggle(setting.id, !(setting.value as boolean));
      }
    }

    // Reset to defaults
    if (input === 'R') {
      resetToDefaults();
    }
  });

  const handleToggle = (settingId: string, value: boolean) => {
    if (activeSection === 'ui') {
      setUIConfig({ [settingId]: value } as Partial<UIConfig>);
    }
  };

  return (
    <Box flexDirection="column" width={width} paddingX={1}>
      {/* Title */}
      <Box marginBottom={1}>
        <Text bold>Settings</Text>
        <Text color="gray"> • Tab to switch sections</Text>
      </Box>

      {/* Section tabs */}
      <Box marginBottom={1}>
        {sections.map((section, idx) => (
          <Box key={section.id} marginRight={2}>
            <Text
              bold={section.id === activeSection}
              color={section.id === activeSection ? 'blue' : 'gray'}
              underline={section.id === activeSection}
            >
              {section.label}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Settings list */}
      <Box flexDirection="column" borderStyle="single" paddingX={1} paddingY={1}>
        {currentSettings.length === 0 ? (
          <Text color="gray">No settings available</Text>
        ) : (
          currentSettings.map((setting, idx) => (
            <Box key={setting.id} marginBottom={idx < currentSettings.length - 1 ? 1 : 0}>
              <Box width={3}>
                <Text color={idx === selectedIndex ? 'blue' : undefined}>
                  {idx === selectedIndex ? '▸' : ' '}
                </Text>
              </Box>
              <Box width={25}>
                <Text bold={idx === selectedIndex}>{setting.label}</Text>
              </Box>
              <Box>
                {setting.type === 'toggle' && (
                  <Toggle
                    enabled={setting.value as boolean}
                    onChange={(v) => handleToggle(setting.id, v)}
                  />
                )}
                {setting.type === 'radio' && setting.options && (
                  <Text color="cyan">
                    {setting.options.find((o) => o.value === setting.value)?.label ?? String(setting.value)}
                  </Text>
                )}
                {setting.type === 'select' && (
                  <Text color="cyan">{String(setting.value)}</Text>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* Help */}
      <Box marginTop={1}>
        <Text color="gray">
          j/k:navigate  Enter/Space:toggle  Tab:section  R:reset  q:back
        </Text>
      </Box>
    </Box>
  );
}

export default SettingsScreen;
