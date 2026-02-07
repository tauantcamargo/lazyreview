import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import {
  StatusBar,
  HelpPanel,
  CommandPalette,
  ToastContainer,
  Panel,
  SearchInput,
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
    addToast({ message: 'Jumped to top', type: 'info' });
  }, [setSelectedListIndex, addToast]);

  const generalComment = useCallback(() => {
    // TODO: Open comment dialog
    addToast({ message: 'General comment (coming soon)', type: 'info' });
  }, [addToast]);

  const refresh = useCallback(() => {
    if (selectedRepo) {
      queryClient.invalidateQueries({ queryKey: pullRequestKeys.lists() });
      addToast({ message: 'Refreshing...', type: 'info' });
    }
  }, [selectedRepo, queryClient, addToast]);

  // Chord definitions
  const chordDefinitions: ChordDefinition[] = React.useMemo(() => [
    { keys: 'gg', action: goToTop, description: 'Go to top' },
    { keys: 'gc', action: generalComment, description: 'General comment' },
    { keys: 'gr', action: refresh, description: 'Refresh' },
    { keys: 'gd', action: () => setView('detail'), description: 'Go to detail' },
    { keys: 'gf', action: () => setView('files'), description: 'Go to files' },
    { keys: 'ga', action: () => setView('ai'), description: 'Go to AI review' },
  ], [goToTop, generalComment, refresh, setView]);

  // Chord handler
  const { handleInput: handleChord, state: chordState, reset: resetChord } = useChord({
    chords: chordDefinitions,
    timeout: 500,
    onChordComplete: (chord) => {
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

    // Tab switching with Tab key
    if (key.tab) {
      const tabs: FilterTab[] = ['all', 'recent', 'favorites', 'mine', 'review'];
      const currentIdx = tabs.indexOf(activeTab);
      const nextIdx = (currentIdx + 1) % tabs.length;
      setActiveTab(tabs[nextIdx]);
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

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Header Bar - LazyGit style */}
      <Box height={1}>
        <Text color="magenta" bold>LazyReview</Text>
        <Text color="white"> – </Text>
        <Text color="magenta" bold>My PRs ({pullRequests.length})</Text>
        <Text color="gray"> | branch </Text>
        <Text color={demoMode ? "yellow" : "white"} bold={demoMode}>{branchInfo}</Text>
        {demoMode && <Text color="yellow" bold> ⚠ DEMO DATA - Start with --repo to see real PRs</Text>}
        {/* Chord indicator - shows pending keys */}
        {chordState.isActive && !demoMode && (
          <>
            <Text color="gray"> | </Text>
            <ChordIndicator pendingKeys={chordState.buffer.split('')} />
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
              borderStyle="single"
              borderColor={focusedPanel === 'nav' ? 'magenta' : 'gray'}
            >
              <Box paddingX={1} borderBottom borderColor={focusedPanel === 'nav' ? 'magenta' : 'gray'}>
                <Text color={focusedPanel === 'nav' ? 'magenta' : 'white'} bold>Navigation</Text>
              </Box>
              <Box paddingX={1}>
                <Text color="gray">{navItems.length} items</Text>
              </Box>
              <Box flexDirection="column" paddingX={1} paddingY={1}>
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
          borderStyle="single"
          borderColor={focusedPanel === 'list' ? 'magenta' : 'gray'}
        >
          <Box paddingX={1} borderBottom borderColor={focusedPanel === 'list' ? 'magenta' : 'gray'}>
            <Text color={focusedPanel === 'list' ? 'magenta' : 'white'} bold>Pull Requests</Text>
          </Box>
          <Box paddingX={1}>
            <Text color="gray">{pullRequests.length} items</Text>
          </Box>
          <Box flexDirection="column" flexGrow={1}>
            <CurrentScreen
              view={currentView}
              width={mainWidth - 2}
              height={contentHeight - 4}
              isFocused={focusedPanel === 'list'}
            />
          </Box>
          {/* Panel footer with keybindings or search */}
          <Box paddingX={1} borderTop borderColor="gray">
            {isSearchMode ? (
              <Box>
                <Text color="cyan">/ </Text>
                <Text>{searchQuery}</Text>
                <Text inverse> </Text>
                <Text color="gray"> (Enter to confirm, Esc to cancel)</Text>
              </Box>
            ) : searchQuery ? (
              <Box>
                <Text color="cyan">Filter: </Text>
                <Text color="yellow">{searchQuery}</Text>
                <Text color="gray"> (Esc to clear)</Text>
              </Box>
            ) : (
              <Text color="gray">{getStatusBarContent()}</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* Bottom Status */}
      <Box height={1} marginTop={0}>
        {searchQuery ? (
          <Text color="gray">
            Showing {pullRequests.filter(pr =>
              pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              pr.author.login.toLowerCase().includes(searchQuery.toLowerCase())
            ).length} of {pullRequests.length} pull requests
          </Text>
        ) : (
          <Text color="gray">Loaded {pullRequests.length} pull requests</Text>
        )}
      </Box>

      {/* Overlays */}
      {isHelpOpen && (
        <HelpOverlay onClose={toggleHelp} width={width} height={height} />
      )}

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
              addToast({ message, type: 'success' });
              setActiveAction(null);
            }}
            onError={(message) => {
              addToast({ message, type: 'error' });
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
        position="bottom-right"
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

function TabBar({ tabs, activeTab, onSelect }: TabBarProps): React.ReactElement {
  return (
    <Box>
      {tabs.map((tab, index) => (
        <React.Fragment key={tab.id}>
          {index > 0 && <Text color="gray"> | </Text>}
          <Text
            color={tab.id === activeTab ? 'magenta' : 'white'}
            bold={tab.id === activeTab}
            inverse={tab.id === activeTab}
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
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text
        color={selected ? 'magenta' : 'white'}
        bold={selected}
        inverse={selected}
      >
        {selected ? '│ ' : '│ '}{label}
      </Text>
      <Text color="gray">│ {description}</Text>
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
  switch (view) {
    case 'list':
      return <PRListScreen width={width} height={height} isFocused={isFocused} />;
    case 'detail':
      return <PRDetailScreen width={width} height={height} />;
    case 'files':
      return <DiffScreen width={width} height={height} />;
    case 'dashboard':
      return <DashboardScreen width={width} height={height} />;
    case 'settings':
      return <SettingsScreen width={width} height={height} />;
    case 'ai':
      return <AIReviewScreen width={width} height={height} />;
    default:
      return <PRListScreen width={width} height={height} isFocused={isFocused} />;
  }
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

  return (
    <HelpPanel
      sections={helpSections}
      width={width}
      height={height}
      onClose={onClose}
    />
  );
}

// Command palette overlay component
interface CommandPaletteOverlayProps {
  onClose: () => void;
  onExecute: (command: string) => void;
  width: number;
}

function CommandPaletteOverlay({
  onClose,
  onExecute,
}: CommandPaletteOverlayProps): React.ReactElement {
  const commands = [
    { id: 'list', label: 'Go to PR List', shortcut: '1' },
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: '2' },
    { id: 'settings', label: 'Open Settings', shortcut: '3' },
    { id: 'refresh', label: 'Refresh', shortcut: 'R' },
    { id: 'quit', label: 'Quit', shortcut: 'Ctrl+C' },
  ];

  return (
    <CommandPalette
      commands={commands}
      onSelect={onExecute}
      onClose={onClose}
      placeholder="Type a command..."
    />
  );
}

// Command handler
function handleCommand(
  command: string,
  setView: (view: ViewType) => void,
  exit: () => void
): void {
  switch (command) {
    case 'list':
      setView('list');
      break;
    case 'dashboard':
      setView('dashboard');
      break;
    case 'settings':
      setView('settings');
      break;
    case 'quit':
      exit();
      break;
    default:
      break;
  }
}

export default App;
