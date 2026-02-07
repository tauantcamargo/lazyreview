import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import {
  HelpPanel,
  CommandPalette,
  ToastContainer,
  ChordIndicator,
  useChord,
  type ChordDefinition,
} from '@lazyreview/ui';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAppStore,
  useCurrentView,
  useIsSidebarVisible,
  useIsCommandPaletteOpen,
  usePullRequests,
} from './stores/app-store.js';
import {
  PRListScreen,
  PRDetailScreen,
  DiffScreen,
  DashboardScreen,
  SettingsScreen,
  AIReviewScreen,
} from './screens/index.js';
import { PRActionDialogs, type PRActionType } from './components/index.js';
import { useToast, useConfig, pullRequestKeys } from './hooks/index.js';
import type { ViewType } from './stores/app-store.js';
import { match } from 'ts-pattern';

export interface AppProps {
  width?: number;
  height?: number;
  provider?: string;
  repo?: string;
}

// Filter tabs matching Go version
type FilterTab = 'all' | 'recent' | 'favorites' | 'mine' | 'review';

/**
 * Main Application Component - LazyGit-style layout
 */
export function App({ width: initialWidth = 80, height: initialHeight = 24 }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // Track terminal dimensions with resize support
  const [dimensions, setDimensions] = useState({
    width: stdout?.columns || initialWidth,
    height: stdout?.rows || initialHeight,
  });

  // Handle terminal resize
  useEffect(() => {
    if (!stdout) return;

    const handleResize = () => {
      setDimensions({
        width: stdout.columns || initialWidth,
        height: stdout.rows || initialHeight,
      });
    };

    stdout.on('resize', handleResize);
    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout, initialWidth, initialHeight]);

  const { width, height } = dimensions;
  const currentView = useCurrentView();
  const isSidebarVisible = useIsSidebarVisible();
  const isCommandPaletteOpen = useIsCommandPaletteOpen();
  const pullRequests = usePullRequests();
  const { config, isVimMode } = useConfig();

  const setView = useAppStore((s) => s.setView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette);
  const isHelpOpen = useAppStore((s) => s.isHelpOpen);
  const selectedRepo = useAppStore((s) => s.selectedRepo);
  const demoMode = useAppStore((s) => s.demoMode);

  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  // Active filter tab
  const [activeTab, setActiveTab] = React.useState<FilterTab>('mine');

  // Navigation sidebar selected item
  const [navIndex, setNavIndex] = React.useState(1); // Default to "My PRs"

  // Panel focus: 'nav' for navigation panel, 'list' for PR list
  const [focusedPanel, setFocusedPanel] = React.useState<'nav' | 'list'>('list');

  // Search mode state
  const [isSearchMode, setIsSearchMode] = React.useState(false);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setSelectedListIndex = useAppStore((s) => s.setSelectedListIndex);

  // PR action dialog state
  const [activeAction, setActiveAction] = React.useState<PRActionType>(null);
  const selectedPRNumber = useAppStore((s) => s.selectedPRNumber);

  // Chord actions
  const goToTop = useCallback(() => {
    setSelectedListIndex(0);
    addToast('Jumped to top', 'info');
  }, [setSelectedListIndex, addToast]);

  const generalComment = useCallback(() => {
    // TODO: Open comment dialog
    addToast('General comment (coming soon)', 'info');
  }, [addToast]);

  const refresh = useCallback(() => {
    if (selectedRepo) {
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.lists() });
      addToast('Refreshing...', 'info');
    }
  }, [selectedRepo, queryClient, addToast]);

  // Chord definitions
  const chordDefinitions: ChordDefinition[] = React.useMemo(
    () => [
      { keys: 'gg', action: goToTop, description: 'Go to top' },
      { keys: 'gc', action: generalComment, description: 'General comment' },
      { keys: 'gr', action: refresh, description: 'Refresh' },
      { keys: 'gd', action: () => setView('detail'), description: 'Go to detail' },
      { keys: 'gf', action: () => setView('files'), description: 'Go to files' },
      { keys: 'ga', action: () => setView('ai'), description: 'Go to AI review' },
    ],
    [goToTop, generalComment, refresh, setView]
  );

  // Chord handler
  const {
    handleInput: handleChord,
    state: chordState,
    reset: resetChord,
  } = useChord({
    chords: chordDefinitions,
    timeout: 500,
    onChordComplete: (_chord: string) => {
      // Chord executed successfully
    },
    onChordCancel: () => {
      // Chord timed out or cancelled
    },
  });

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Quit application
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Handle search mode input
    if (isSearchMode) {
      resetChord();
      if (key.escape) {
        setIsSearchMode(false);
        setSearchQuery('');
        return;
      }
      if (key.return) {
        setIsSearchMode(false);
        return;
      }
      if (key.backspace || key.delete) {
        setSearchQuery(searchQuery.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setSearchQuery(searchQuery + input);
      }
      return;
    }

    // Don't process shortcuts when command palette is open
    if (isCommandPaletteOpen) {
      resetChord();
      if (key.escape) {
        toggleCommandPalette();
      }
      return;
    }

    // Don't process shortcuts when help is open
    if (isHelpOpen) {
      resetChord();
      if (key.escape || input === '?' || input === 'q') {
        toggleHelp();
      }
      return;
    }

    // Don't process shortcuts when PR action dialog is open
    if (activeAction) {
      // Dialog handles its own input
      return;
    }

    // Try chord handling first (for multi-key sequences like gg, gc, gr)
    if (input && !key.ctrl && !key.meta && !key.escape) {
      const handled = handleChord(input);
      if (handled) {
        return;
      }
    }

    // Activate search mode with /
    if (input === '/') {
      setIsSearchMode(true);
      return;
    }

    // Clear search with Escape
    if (key.escape && searchQuery) {
      setSearchQuery('');
      return;
    }

    // Toggle help
    if (input === '?') {
      toggleHelp();
      return;
    }

    // Toggle command palette
    if (key.ctrl && input === 'p') {
      toggleCommandPalette();
      return;
    }

    // Toggle sidebar
    if (input === 'b' || input === '\\') {
      toggleSidebar();
      return;
    }

    // PR action shortcuts (only when a PR is selected)
    if (selectedPRNumber && (currentView === 'detail' || currentView === 'files')) {
      if (input === 'a') {
        setActiveAction('approve');
        return;
      }
      if (input === 'x') {
        setActiveAction('request-changes');
        return;
      }
      if (input === 'c') {
        setActiveAction('comment');
        return;
      }
      if (input === 'm') {
        setActiveAction('merge');
        return;
      }
    }

    // View shortcuts
    if (input === '1') setView('list');
    else if (input === '2') setView('dashboard');
    else if (input === '3') setView('settings');

    // Global filter tab switching with Shift+Tab (works everywhere)
    if (key.tab && key.shift) {
      const tabs: FilterTab[] = ['all', 'recent', 'favorites', 'mine', 'review'];
      const currentIdx = tabs.indexOf(activeTab);
      const nextIdx = (currentIdx + 1) % tabs.length;
      const nextTab = tabs[nextIdx];
      if (nextTab !== undefined) setActiveTab(nextTab);
      return; // Prevent other tab handling
    }

    // Local tab switching with Tab (only in list view, for local navigation)
    if (key.tab && currentView === 'list') {
      const tabs: FilterTab[] = ['all', 'recent', 'favorites', 'mine', 'review'];
      const currentIdx = tabs.indexOf(activeTab);
      const nextIdx = (currentIdx + 1) % tabs.length;
      const nextTab = tabs[nextIdx];
      if (nextTab !== undefined) setActiveTab(nextTab);
    }

    // Panel focus switching (h/l or left/right arrows)
    if ((input === 'h' || key.leftArrow) && isSidebarVisible) {
      setFocusedPanel('nav');
    } else if (input === 'l' || key.rightArrow) {
      setFocusedPanel('list');
    }

    // Navigation in nav panel when focused
    if (focusedPanel === 'nav' && isSidebarVisible) {
      if (input === 'j' || key.downArrow) {
        setNavIndex((prev) => Math.min(prev + 1, navItems.length - 1));
      } else if (input === 'k' || key.upArrow) {
        setNavIndex((prev) => Math.max(prev - 1, 0));
      } else if (key.return) {
        const selectedNav = navItems[navIndex];
        if (selectedNav) {
          if (selectedNav.id === 'dashboard') setView('dashboard');
          else if (selectedNav.id === 'settings') setView('settings');
          else setView('list');
        }
      }
    }
  });

  // Calculate layout dimensions
  const headerHeight = 2; // Title bar + tabs
  const footerHeight = 2; // Status bar + loaded message
  const contentHeight = height - headerHeight - footerHeight;
  const sidebarWidth = isSidebarVisible ? Math.min(30, Math.floor(width * 0.3)) : 0;
  const mainWidth = width - sidebarWidth - (isSidebarVisible ? 1 : 0);

  // Navigation items (left panel)
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', desc: 'Grouped PR overview' },
    { id: 'mine', label: `My PRs (${pullRequests.length})`, desc: 'PRs you authored (all repos)' },
    { id: 'review', label: 'Review Requests', desc: 'PRs needing your review' },
    { id: 'assigned', label: 'Assigned to Me', desc: 'PRs assigned to you' },
    { id: 'current', label: 'Current Repo', desc: 'PRs in detected repo' },
    { id: 'workspaces', label: 'Workspaces', desc: 'Create and manage repo groups' },
    { id: 'settings', label: `Settings (update v${config.version})`, desc: 'Configure LazyReview' },
  ];

  // Get current branch info
  const branchInfo = demoMode ? 'demo-mode' : 'tc/rewrite-work (dirty)';

  // Status bar content
  const getStatusBarContent = (): string => {
    const nav = isVimMode ? '↑/k up • ↓/j down • h/l panels' : '↑ up • ↓ down • ←/→ panels';
    return `${nav} • / filter • q quit • ? more`;
  };

  // If help is open, render full-screen centered modal
  if (isHelpOpen) {
    return (
      <Box flexDirection="column" width={width} height={height} alignItems="center" justifyContent="center">
        <HelpOverlay onClose={toggleHelp} width={width} height={height} />
      </Box>
    );
  }

  // Theme colors for modern look
  const accentColor = '#7aa2f7'; // Tokyo Night blue
  const mutedColor = '#565f89';
  const borderColor = '#3b4261';
  const successColor = '#9ece6a';
  const warningColor = '#e0af68';

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header Bar - Modern style */}
      <Box height={1}>
        <Text color={accentColor} bold>
          LazyReview
        </Text>
        <Text color={mutedColor}> • </Text>
        <Text color="white">{pullRequests.length} PRs</Text>
        <Text color={mutedColor}> • </Text>
        <Text color={demoMode ? warningColor : mutedColor}>{branchInfo}</Text>
        {demoMode && <Text color={warningColor}> ⚠ DEMO</Text>}
        {/* Chord indicator - shows pending keys */}
        {chordState.isActive && !demoMode && (
          <>
            <Text color={mutedColor}> • </Text>
            <ChordIndicator chord={chordState.buffer} pending={chordState.isActive} />
          </>
        )}
      </Box>

      {/* Tab Bar */}
      <Box height={1} marginBottom={0}>
        <TabBar
          tabs={[
            { id: 'all', label: 'All' },
            { id: 'recent', label: 'Recent' },
            { id: 'favorites', label: 'Favorites' },
            { id: 'mine', label: 'My PRs' },
            { id: 'review', label: 'To Review' },
          ]}
          activeTab={activeTab}
          onSelect={(tab) => setActiveTab(tab as FilterTab)}
        />
      </Box>

      {/* Main Content Area */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Left Navigation Panel */}
        {isSidebarVisible && (
          <>
            <Box
              width={sidebarWidth}
              flexDirection="column"
              borderStyle="round"
              borderColor={focusedPanel === 'nav' ? accentColor : borderColor}
            >
              <Box paddingX={1}>
                <Text color={focusedPanel === 'nav' ? accentColor : 'white'} bold>
                  Navigation
                </Text>
                <Text color={mutedColor}> ({navItems.length})</Text>
              </Box>
              <Box flexDirection="column" paddingX={1}>
                {navItems.map((item, index) => (
                  <NavigationItem
                    key={item.id}
                    label={item.label}
                    description={item.desc}
                    selected={index === navIndex}
                    onSelect={() => {
                      setNavIndex(index);
                      if (item.id === 'dashboard') setView('dashboard');
                      else if (item.id === 'settings') setView('settings');
                      else setView('list');
                    }}
                  />
                ))}
              </Box>
            </Box>
            <Box width={1} />
          </>
        )}

        {/* Right Content Panel */}
        <Box
          width={mainWidth}
          flexDirection="column"
          borderStyle="round"
          borderColor={focusedPanel === 'list' ? accentColor : borderColor}
        >
          <Box paddingX={1}>
            <Text color={focusedPanel === 'list' ? accentColor : 'white'} bold>
              Pull Requests
            </Text>
            <Text color={mutedColor}> ({pullRequests.length})</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <CurrentScreen
              view={currentView}
              width={mainWidth - 2}
              height={contentHeight - 3}
              isFocused={focusedPanel === 'list'}
            />
          </Box>
          {/* Panel footer with keybindings or search */}
          <Box paddingX={1}>
            {isSearchMode ? (
              <Box>
                <Text color={accentColor}>/</Text>
                <Text>{searchQuery}</Text>
                <Text inverse> </Text>
                <Text color={mutedColor}> Enter to confirm, Esc to cancel</Text>
              </Box>
            ) : searchQuery ? (
              <Box>
                <Text color={accentColor}>Filter: </Text>
                <Text color={successColor}>{searchQuery}</Text>
                <Text color={mutedColor}> (Esc to clear)</Text>
              </Box>
            ) : (
              <Text color={mutedColor}>{getStatusBarContent()}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Status */}
      <Box height={1} marginTop={0} paddingX={1}>
        {searchQuery ? (
          <Text color={mutedColor}>
            Showing{' '}
            {
              pullRequests.filter(
                (pr) =>
                  pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  pr.author.login.toLowerCase().includes(searchQuery.toLowerCase())
              ).length
            }{' '}
            of {pullRequests.length} PRs
          </Text>
        ) : (
          <Text color={mutedColor}>{pullRequests.length} PRs loaded</Text>
        )}
      </Box>

      {/* Overlays */}
      {isCommandPaletteOpen && (
        <CommandPaletteOverlay
          onClose={toggleCommandPalette}
          onExecute={(command) => {
            handleCommand(command, setView, exit);
            toggleCommandPalette();
          }}
          width={width}
        />
      )}

      {/* PR Action Dialogs */}
      {activeAction && (
        <Box
          position="absolute"
          marginTop={Math.floor(height / 4)}
          marginLeft={Math.floor(width / 4)}
          width={Math.floor(width / 2)}
        >
          <PRActionDialogs
            action={activeAction}
            onClose={() => setActiveAction(null)}
            onSuccess={(message) => {
              addToast(message, 'success');
              setActiveAction(null);
            }}
            onError={(message) => {
              addToast(message, 'error');
            }}
          />
        </Box>
      )}

      {/* Toast notifications */}
      <ToastContainer
        toasts={toasts.map((t) => ({
          id: t.id,
          message: t.message,
          type: t.type,
          onDismiss: () => removeToast(t.id),
        }))}
        position="bottom"
      />
    </Box>
  );
}

// Tab Bar Component
interface TabBarProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onSelect: (id: string) => void;
}

function TabBar({ tabs, activeTab }: TabBarProps): React.ReactElement {
  const accentColor = '#7aa2f7';
  const mutedColor = '#565f89';

  return (
    <Box>
      {tabs.map((tab, index) => (
        <React.Fragment key={tab.id}>
          {index > 0 && <Text color={mutedColor}> • </Text>}
          <Text
            color={tab.id === activeTab ? accentColor : mutedColor}
            bold={tab.id === activeTab}
            underline={tab.id === activeTab}
          >
            {tab.label}
          </Text>
        </React.Fragment>
      ))}
    </Box>
  );
}

// Navigation Item Component
interface NavigationItemProps {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

function NavigationItem({ label, description, selected }: NavigationItemProps): React.ReactElement {
  const accentColor = '#7aa2f7';
  const mutedColor = '#565f89';

  return (
    <Box flexDirection="column" marginBottom={0}>
      <Box>
        <Text color={selected ? accentColor : mutedColor}>{selected ? '▸ ' : '  '}</Text>
        <Text color={selected ? 'white' : mutedColor} bold={selected}>
          {label}
        </Text>
      </Box>
      {selected && (
        <Box marginLeft={2}>
          <Text color={mutedColor}>{description}</Text>
        </Box>
      )}
    </Box>
  );
}

// Screen router component
interface CurrentScreenProps {
  view: ViewType;
  width: number;
  height: number;
  isFocused: boolean;
}

function CurrentScreen({ view, width, height, isFocused }: CurrentScreenProps): React.ReactElement {
  return match(view)
    .with('list', () => <PRListScreen width={width} height={height} isFocused={isFocused} />)
    .with('detail', () => <PRDetailScreen width={width} height={height} />)
    .with('files', () => <DiffScreen width={width} height={height} />)
    .with('dashboard', () => <DashboardScreen width={width} height={height} />)
    .with('settings', () => <SettingsScreen width={width} height={height} />)
    .with('ai', () => <AIReviewScreen width={width} height={height} />)
    .otherwise(() => <PRListScreen width={width} height={height} isFocused={isFocused} />);
}

// Help overlay component
interface HelpOverlayProps {
  onClose: () => void;
  width: number;
  height: number;
}

function HelpOverlay({ onClose, width, height }: HelpOverlayProps): React.ReactElement {
  const helpSections = [
    {
      title: 'Navigation',
      bindings: [
        { key: 'j/k', description: 'Move down/up' },
        { key: 'h/l', description: 'Move left/right' },
        { key: 'gg', description: 'Go to top', chord: true },
        { key: 'G', description: 'Go to bottom' },
        { key: 'Ctrl+u/d', description: 'Page up/down' },
      ],
    },
    {
      title: 'Actions',
      bindings: [
        { key: 'Enter', description: 'Select/confirm' },
        { key: 'a', description: 'Approve PR' },
        { key: 'x', description: 'Request changes' },
        { key: 'c', description: 'Add comment' },
        { key: 'm', description: 'Merge PR' },
      ],
    },
    {
      title: 'Views',
      bindings: [
        { key: '1', description: 'PR List' },
        { key: '2', description: 'Dashboard' },
        { key: '3', description: 'Settings' },
        { key: 'b', description: 'Toggle sidebar' },
        { key: '?', description: 'Toggle help' },
      ],
    },
  ];

  // Modal dimensions - centered on screen
  const modalWidth = Math.min(50, width - 4);
  const modalHeight = Math.min(22, height - 4);

  return <HelpPanel sections={helpSections} width={modalWidth} height={modalHeight} onClose={onClose} />;
}

// Command palette overlay component
interface CommandPaletteOverlayProps {
  onClose: () => void;
  onExecute: (command: string) => void;
  width: number;
}

function CommandPaletteOverlay({ onClose, onExecute }: CommandPaletteOverlayProps): React.ReactElement {
  const commands = [
    { id: 'list', label: 'Go to PR List', shortcut: '1', action: () => onExecute('list') },
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: '2', action: () => onExecute('dashboard') },
    { id: 'settings', label: 'Open Settings', shortcut: '3', action: () => onExecute('settings') },
    { id: 'refresh', label: 'Refresh', shortcut: 'R', action: () => onExecute('refresh') },
    { id: 'quit', label: 'Quit', shortcut: 'Ctrl+C', action: () => onExecute('quit') },
  ];

  return <CommandPalette commands={commands} isOpen onClose={onClose} />;
}

function handleCommand(command: string, setView: (view: ViewType) => void, exit: () => void): void {
  return match(command)
    .with('list', () => setView('list'))
    .with('dashboard', () => setView('dashboard'))
    .with('settings', () => setView('settings'))
    .with('quit', () => exit())
    .otherwise(() => {});
}

export default App;
