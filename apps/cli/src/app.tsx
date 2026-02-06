import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import type { Key } from 'ink';
import {
  DiffView,
  VirtualList,
  VirtualListItem,
  Sidebar,
  SidebarItem,
  FileTree,
  FileChange,
  StatusBar,
  CommandPalette,
  Command,
  useChord,
  ChordDefinition,
  getTheme,
  themes,
  defaultTheme,
  Spinner,
  ErrorMessage,
  Dashboard,
  DashboardSection,
  DashboardItem,
  HelpPanel,
  HelpSection,
  ConfirmDialog,
  PRDetail,
  PRDetailData,
} from '@lazyreview/ui';
import { LazyReviewStorage } from '@lazyreview/storage';
import { processDiff } from './utils/diffWorker';
import {
  buildProviderBaseUrl,
  createAIClient,
  createProvider,
  defaultProviderHost,
  loadConfig,
  readToken,
  readAIKey,
  saveConfig,
  type ProviderType,
  type PullRequest,
} from '@lazyreview/core';

const SAMPLE_DIFF = `diff --git a/src/math.ts b/src/math.ts
index 1c0f3a4..4d2f2e1 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,8 +1,14 @@
 export function add(a: number, b: number) {
-  return a + b;
+  const result = a + b;
+  return result;
 }

 export function subtract(a: number, b: number) {
   return a - b;
 }
+
+export function multiply(a: number, b: number) {
+  return a * b;
+}

diff --git a/src/app.ts b/src/app.ts
index 98b1f09..a84b2c1 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,12 +10,20 @@ export function main() {
-  console.log('Hello');
+  console.log('Hello, LazyReview');
+
+  if (process.env.DEBUG) {
+    console.log('Debug mode enabled');
+  }
 }
`;

export type AppProps = {
  provider?: string;
  repo?: string;
};

type ViewMode = 'dashboard' | 'list' | 'diff' | 'files' | 'settings' | 'ai' | 'detail' | 'help';
type PanelFocus = 'sidebar' | 'main' | 'detail';

function buildSamplePRs(count: number): VirtualListItem[] {
  const items: VirtualListItem[] = [];
  for (let i = 1; i <= count; i += 1) {
    items.push({
      id: String(i),
      title: `PR #${i} Improve performance for list rendering`,
      description: `lazyreview/repo-${(i % 7) + 1} • updated ${(i % 13) + 1}h ago`,
    });
  }
  return items;
}

function buildSampleSidebarItems(): SidebarItem[] {
  return [
    {
      id: 'all',
      label: 'All Repositories',
      count: 47,
      expanded: true,
      children: [
        {
          id: 'github',
          label: 'github',
          count: 32,
          indent: 1,
          expanded: true,
          children: [
            { id: 'github/org/repo1', label: 'org/repo1', count: 12, indent: 2 },
            { id: 'github/org/repo2', label: 'org/repo2', count: 8, indent: 2 },
            { id: 'github/user/project', label: 'user/project', count: 12, indent: 2 },
          ],
        },
        {
          id: 'gitlab',
          label: 'gitlab',
          count: 15,
          indent: 1,
          expanded: false,
          children: [
            { id: 'gitlab/group/project', label: 'group/project', count: 15, indent: 2 },
          ],
        },
      ],
    },
  ];
}

function buildSampleFiles(): FileChange[] {
  return [
    { path: 'src/math.ts', additions: 8, deletions: 2, status: 'modified' },
    { path: 'src/app.ts', additions: 6, deletions: 1, status: 'modified' },
    { path: 'src/utils/helper.ts', additions: 25, deletions: 0, status: 'added' },
    { path: 'tests/math.test.ts', additions: 15, deletions: 3, status: 'modified' },
    { path: 'docs/README.md', additions: 10, deletions: 5, status: 'modified' },
    { path: 'old-file.ts', additions: 0, deletions: 45, status: 'deleted' },
  ];
}

function mapPullRequests(prs: PullRequest[]): VirtualListItem[] {
  return prs.map((pr) => ({
    id: pr.id,
    title: `#${pr.number} ${pr.title}`,
    description: `${pr.repo} • ${pr.author} • ${new Date(pr.updatedAt).toLocaleString()}`,
  }));
}

function buildDashboardSections(prs: PullRequest[]): DashboardSection[] {
  const needsReview: DashboardItem[] = [];
  const myPrs: DashboardItem[] = [];
  const recentlyUpdated: DashboardItem[] = [];

  for (const pr of prs) {
    const item: DashboardItem = {
      id: pr.id,
      repo: pr.repo,
      title: `#${pr.number} ${pr.title}`,
      author: pr.author,
      status: pr.state === 'open' ? 'open' : pr.state === 'merged' ? 'merged' : 'closed',
      updatedAt: pr.updatedAt,
    };

    // Simple categorization - could be enhanced with user context
    if (pr.state === 'open') {
      needsReview.push(item);
    }
    recentlyUpdated.push(item);
  }

  return [
    {
      id: 'needs-review',
      title: 'Needs Review',
      items: needsReview.slice(0, 10),
      emptyMessage: 'No PRs need your review',
    },
    {
      id: 'recent',
      title: 'Recently Updated',
      items: recentlyUpdated.slice(0, 10),
      emptyMessage: 'No recent activity',
    },
  ];
}

function buildHelpSections(): HelpSection[] {
  return [
    {
      title: 'Navigation',
      bindings: [
        { key: 'j/↓', description: 'Move down' },
        { key: 'k/↑', description: 'Move up' },
        { key: 'gg', description: 'Go to top', chord: true },
        { key: 'G', description: 'Go to bottom' },
        { key: 'Ctrl+d', description: 'Page down' },
        { key: 'Ctrl+u', description: 'Page up' },
        { key: 'Tab', description: 'Next panel' },
      ],
    },
    {
      title: 'Actions',
      bindings: [
        { key: 'Enter', description: 'Select/Open' },
        { key: 's', description: 'AI Summary' },
        { key: 'A', description: 'AI Review' },
        { key: 'f', description: 'View files' },
        { key: 'gr', description: 'Refresh', chord: true },
      ],
    },
    {
      title: 'View',
      bindings: [
        { key: 'Ctrl+b', description: 'Toggle sidebar' },
        { key: 'Ctrl+p', description: 'Command palette' },
        { key: 't', description: 'Theme settings' },
        { key: '?', description: 'Toggle help' },
        { key: 'q/Esc', description: 'Back/Quit' },
      ],
    },
  ];
}

function parseRepo(input: string, provider: ProviderType): { owner: string; repo: string } {
  const parts = input.split('/');
  if (provider === 'azuredevops') {
    if (parts.length < 3) {
      throw new Error('Azure DevOps repo must be in org/project/repo format');
    }
    const org = parts[0] ?? '';
    const project = parts[1] ?? '';
    const repoName = parts[2] ?? '';
    return { owner: `${org}/${project}`, repo: repoName };
  }

  if (parts.length < 2) {
    throw new Error('Repo must be in owner/name format');
  }

  const owner = parts[0] ?? '';
  const repoName = parts[1] ?? '';
  return { owner, repo: repoName };
}

export function App({ provider, repo }: AppProps): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;

  const [view, setView] = useState<ViewMode>('dashboard');
  const [focus, setFocus] = useState<PanelFocus>('main');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [dashboardSections, setDashboardSections] = useState<DashboardSection[]>([]);
  const [selectedDashboardSection, setSelectedDashboardSection] = useState(0);
  const [selectedDashboardItem, setSelectedDashboardItem] = useState(0);
  const helpSections = useMemo(() => buildHelpSections(), []);

  const sampleItems = useMemo(() => buildSamplePRs(100), []);
  const sidebarItems = useMemo(() => buildSampleSidebarItems(), []);
  const sampleFiles = useMemo(() => buildSampleFiles(), []);

  const [items, setItems] = useState<VirtualListItem[]>(sampleItems);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(!repo);
  const [diffText, setDiffText] = useState(SAMPLE_DIFF);
  const [diffStatus, setDiffStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [diffError, setDiffError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [aiMode, setAiMode] = useState<'summary' | 'review'>('summary');
  const [aiEditing, setAiEditing] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [providerContext, setProviderContext] = useState<{
    provider: ProviderType;
    token: string;
    baseUrl: string;
    repo: string;
  } | null>(null);
  const [config, setConfig] = useState(() => loadConfig());
  const theme = getTheme(config.ui?.theme);
  const themeItems = useMemo<VirtualListItem[]>(() => {
    return Object.keys(themes).map((name) => ({
      id: name,
      title: name,
      description: config.ui?.theme === name ? 'current' : '',
    }));
  }, [config.ui?.theme]);

  // Command palette commands
  const commands = useMemo<Command[]>(() => [
    { id: 'go-top', label: 'Go to Top', shortcut: 'gg', category: 'Navigation', action: () => setSelectedIndex(0) },
    { id: 'go-bottom', label: 'Go to Bottom', shortcut: 'G', category: 'Navigation', action: () => setSelectedIndex(items.length - 1) },
    { id: 'refresh', label: 'Refresh', shortcut: 'gr', category: 'Actions', action: () => {} },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+b', category: 'View', action: () => setShowSidebar((s) => !s) },
    { id: 'view-diff', label: 'View Diff', shortcut: 'Enter', category: 'View', action: () => setView('diff') },
    { id: 'view-files', label: 'View Files', shortcut: 'f', category: 'View', action: () => setView('files') },
    { id: 'view-settings', label: 'Settings', shortcut: 't', category: 'View', action: () => setView('settings') },
    { id: 'ai-summary', label: 'AI Summary', shortcut: 's', category: 'AI', action: () => runAi('summary') },
    { id: 'ai-review', label: 'AI Review', shortcut: 'A', category: 'AI', action: () => runAi('review') },
    { id: 'quit', label: 'Quit', shortcut: 'q', category: 'General', action: () => exit() },
  ], [items.length, exit]);

  // Keyboard chords
  const chordDefinitions = useMemo<ChordDefinition[]>(() => [
    { keys: 'gg', action: () => setSelectedIndex(0), description: 'Go to top' },
    { keys: 'gc', action: () => {}, description: 'General comment' },
    { keys: 'gr', action: () => {}, description: 'Refresh' },
    { keys: 'gd', action: () => setView('diff'), description: 'Go to diff' },
    { keys: 'gf', action: () => setView('files'), description: 'Go to files' },
  ], []);

  const { handleInput: handleChord, state: chordState, reset: resetChord } = useChord({
    chords: chordDefinitions,
    timeout: 500,
  });

  async function runAi(mode: 'summary' | 'review'): Promise<void> {
    setAiMode(mode);
    setAiStatus('loading');
    setAiError(null);
    setAiText('');
    setAiDraft('');
    setAiEditing(false);
    setView('ai');

    try {
      if (config.ai?.enabled === false) {
        throw new Error('AI is disabled in config');
      }
      const providerName = config.ai?.provider ?? 'openai';
      const key = await readAIKey(providerName);
      const client = createAIClient(config, key);
      const result = mode === 'summary' ? await client.summarizeDiff(diffText) : await client.reviewDiff(diffText);
      setAiText(result || 'No AI output.');
      setAiStatus('ready');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function postAiReview(): Promise<void> {
    if (!providerContext) {
      setAiError('No provider context available.');
      return;
    }
    try {
      const body = aiEditing ? aiDraft : aiText;
      const prNumber = pullRequests[selectedIndex]?.number;
      if (!prNumber) {
        setAiError('No pull request selected.');
        return;
      }
      const client = createProvider({
        type: providerContext.provider,
        token: providerContext.token,
        baseUrl: providerContext.baseUrl,
      });
      const { owner, repo: repoName } = parseRepo(providerContext.repo, providerContext.provider);
      await client.createReview(owner, repoName, prNumber, {
        event: 'COMMENT',
        body,
      });
      setAiStatus('ready');
      setAiError(null);
      setView('diff');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
    }
  }

  useInput((input: string, key: Key) => {
    // Handle command palette
    if (showCommandPalette) {
      return; // CommandPalette handles its own input
    }

    // Global shortcuts
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (key.ctrl && input === 'p') {
      setShowCommandPalette(true);
      return;
    }

    if (key.ctrl && input === 'b') {
      setShowSidebar((s) => !s);
      return;
    }

    // Toggle help
    if (input === '?') {
      setShowHelp((s) => !s);
      return;
    }

    // Close help panel on escape or q
    if (showHelp && (key.escape || input === 'q')) {
      setShowHelp(false);
      return;
    }

    // Dashboard navigation
    if (view === 'dashboard') {
      if (input === 'j' || key.downArrow) {
        const currentSection = dashboardSections[selectedDashboardSection];
        if (currentSection && selectedDashboardItem < currentSection.items.length - 1) {
          setSelectedDashboardItem((i) => i + 1);
        } else if (selectedDashboardSection < dashboardSections.length - 1) {
          setSelectedDashboardSection((s) => s + 1);
          setSelectedDashboardItem(0);
        }
        return;
      }
      if (input === 'k' || key.upArrow) {
        if (selectedDashboardItem > 0) {
          setSelectedDashboardItem((i) => i - 1);
        } else if (selectedDashboardSection > 0) {
          const prevSection = dashboardSections[selectedDashboardSection - 1];
          setSelectedDashboardSection((s) => s - 1);
          setSelectedDashboardItem(prevSection ? prevSection.items.length - 1 : 0);
        }
        return;
      }
      if (key.return) {
        const section = dashboardSections[selectedDashboardSection];
        const item = section?.items[selectedDashboardItem];
        if (item) {
          // Find the PR and switch to list view
          const prIndex = pullRequests.findIndex((pr) => pr.id === item.id);
          if (prIndex >= 0) {
            setSelectedIndex(prIndex);
            setView('diff');
          }
        }
        return;
      }
      if (input === 'l' || input === 'q' || key.escape) {
        setView('list');
        return;
      }
    }

    // Try chord first
    if (handleChord(input)) {
      return;
    }

    // Panel navigation
    if (key.tab) {
      if (key.shift) {
        setFocus((f) => (f === 'main' ? 'sidebar' : f === 'detail' ? 'main' : 'sidebar'));
      } else {
        setFocus((f) => (f === 'sidebar' ? 'main' : f === 'main' ? 'detail' : 'sidebar'));
      }
      return;
    }

    // View-specific handlers
    if (view === 'ai') {
      if (aiEditing) {
        if (key.escape) {
          setAiEditing(false);
          return;
        }
        if (key.return) {
          setAiDraft((prev) => `${prev}\n`);
          return;
        }
        if (key.backspace || key.delete) {
          setAiDraft((prev) => prev.slice(0, -1));
          return;
        }
        if (input) {
          setAiDraft((prev) => prev + input);
        }
        return;
      }

      if (input === 'q' || key.escape) {
        setView('diff');
        return;
      }
      if (input === 'e') {
        setAiEditing(true);
        setAiDraft(aiText);
        return;
      }
      if (input === 'p' && aiMode === 'review') {
        void postAiReview();
        return;
      }
    }

    if (view === 'diff' && (input === 'q' || key.escape)) {
      setView('list');
      return;
    }

    if (view === 'files' && (input === 'q' || key.escape)) {
      setView('diff');
      return;
    }

    if (view === 'settings' && (input === 'q' || key.escape)) {
      setView('list');
      return;
    }

    if (view === 'list' && input === 't') {
      setView('settings');
      return;
    }

    if (view === 'list' && input === 'f') {
      setView('files');
      return;
    }

    if (view === 'diff' && input === 's') {
      void runAi('summary');
      return;
    }

    if (view === 'diff' && (input === 'A' || input === 'a')) {
      void runAi('review');
      return;
    }

    if (view === 'diff' && input === 'f') {
      setView('files');
      return;
    }

    // Bottom navigation (G)
    if (input === 'G') {
      setSelectedIndex(items.length - 1);
      return;
    }
  });

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!repo) {
        setItems(sampleItems);
        // Build demo dashboard sections
        const demoDashboardItems: DashboardItem[] = sampleItems.slice(0, 10).map((item, idx) => ({
          id: item.id,
          repo: `demo/repo-${(idx % 3) + 1}`,
          title: item.title,
          author: 'demouser',
          status: 'open' as const,
          updatedAt: new Date(Date.now() - idx * 3600000).toISOString(),
        }));
        setDashboardSections([
          { id: 'demo-review', title: 'Needs Review', items: demoDashboardItems.slice(0, 5), emptyMessage: 'No PRs' },
          { id: 'demo-recent', title: 'Recently Updated', items: demoDashboardItems.slice(5, 10), emptyMessage: 'No activity' },
        ]);
        setStatus('ready');
        setDemoMode(true);
        setPullRequests([]);
        setProviderContext(null);
        return;
      }

      setStatus('loading');
      setErrorMessage(null);
      setDemoMode(false);
      const resolvedProvider = (provider ?? config.defaultProvider ?? 'github') as ProviderType;
      const providerConfig = config.providers?.find((p) => p.type === resolvedProvider);
      const host = providerConfig?.host ?? defaultProviderHost(resolvedProvider);
      const envToken = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;
      let token: string | undefined = (await readToken(resolvedProvider, host)) ?? envToken ?? process.env.LAZYREVIEW_TOKEN ?? undefined;
      if (!token && resolvedProvider === 'github' && host === 'github.com') {
        token = (await readToken(resolvedProvider, 'api.github.com')) ?? undefined;
      }
      if (!token && resolvedProvider === 'bitbucket' && host === 'bitbucket.org') {
        token = (await readToken(resolvedProvider, 'api.bitbucket.org')) ?? undefined;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage(`Missing token for ${resolvedProvider}. Run lazyreview auth login.`);
        return;
      }

      const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(resolvedProvider, host);
      if (active) {
        setProviderContext({ provider: resolvedProvider, token, baseUrl, repo });
      }

      try {
        const storage = LazyReviewStorage.open();
        try {
          const cacheKey = `prs:${resolvedProvider}:${repo}`;
          const cached = storage.getCache<PullRequest[]>(cacheKey);
          if (cached && active) {
            setPullRequests(cached.value);
            setItems(mapPullRequests(cached.value));
            setStatus('ready');
          }

          const client = createProvider({ type: resolvedProvider, token, baseUrl });
          const { owner, repo: repoName } = parseRepo(repo, resolvedProvider);
          const prs = await client.listPullRequests(owner, repoName, { limit: 50 });
          storage.setCache(cacheKey, prs, config.performance?.cacheTtl ?? 120);
          if (active) {
            setPullRequests(prs);
            setItems(mapPullRequests(prs));
            setDashboardSections(buildDashboardSections(prs));
            setStatus('ready');
          }
          if (active) {
            setProviderContext({ provider: resolvedProvider, token, baseUrl, repo });
          }
        } finally {
          storage.close();
        }
      } catch (err) {
        if (active) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [provider, repo]);

  const sidebarWidth = showSidebar ? 22 : 0;
  const mainWidth = width - sidebarWidth;
  const contentHeight = Math.max(8, height - 3);
  const detailHeight = Math.floor(contentHeight * 0.4);
  const listHeight = contentHeight - detailHeight;

  const statusBindings = useMemo(() => {
    if (view === 'dashboard') {
      return [
        { key: 'j/k', label: 'move' },
        { key: 'Enter', label: 'open' },
        { key: 'l', label: 'list' },
        { key: '?', label: 'help' },
        { key: 'q', label: 'quit' },
      ];
    }
    if (view === 'list') {
      return [
        { key: 'j/k', label: 'move' },
        { key: 'Enter', label: 'open' },
        { key: 'f', label: 'files' },
        { key: 't', label: 'theme' },
        { key: 'Ctrl+p', label: 'palette' },
        { key: 'q', label: 'quit' },
      ];
    }
    if (view === 'diff') {
      return [
        { key: 'j/k', label: 'scroll' },
        { key: 'f', label: 'files' },
        { key: 's', label: 'summary' },
        { key: 'A', label: 'review' },
        { key: 'q', label: 'back' },
      ];
    }
    if (view === 'files') {
      return [
        { key: 'j/k', label: 'move' },
        { key: 'Enter', label: 'open' },
        { key: 'q', label: 'back' },
      ];
    }
    if (view === 'ai') {
      return [
        { key: 'e', label: 'edit' },
        { key: 'p', label: 'post' },
        { key: 'q', label: 'back' },
      ];
    }
    return [{ key: 'q', label: 'back' }];
  }, [view]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Command Palette Overlay */}
      {showCommandPalette && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 50) / 2)}
          marginTop={2}
        >
          <CommandPalette
            commands={commands}
            isOpen={showCommandPalette}
            width={50}
            theme={theme}
            onClose={() => setShowCommandPalette(false)}
          />
        </Box>
      )}

      {/* Help Panel Overlay */}
      {showHelp && (
        <Box
          position="absolute"
          marginLeft={Math.floor((width - 50) / 2)}
          marginTop={2}
        >
          <HelpPanel
            sections={helpSections}
            width={50}
            height={Math.min(height - 6, 24)}
            theme={theme}
            onClose={() => setShowHelp(false)}
          />
        </Box>
      )}

      {/* Main Content */}
      <Box flexDirection="row" height={contentHeight}>
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar
            title="Repos"
            items={sidebarItems}
            width={sidebarWidth}
            height={contentHeight}
            isActive={focus === 'sidebar'}
            theme={theme}
            onSelect={(item) => {
              // Handle repo selection
            }}
            onToggle={(item) => {
              // Handle expand/collapse
            }}
          />
        )}

        {/* Main Panel */}
        <Box flexDirection="column" width={mainWidth}>
          {view === 'dashboard' ? (
            status === 'loading' ? (
              <Box paddingX={1} height={contentHeight}>
                <Spinner label="Loading pull requests..." theme={theme} />
              </Box>
            ) : status === 'error' ? (
              <Box paddingX={1} height={contentHeight}>
                <ErrorMessage
                  title="Failed to load"
                  message={errorMessage ?? 'Unknown error'}
                  suggestion="Check your network connection and authentication"
                  theme={theme}
                />
              </Box>
            ) : (
              <Dashboard
                sections={dashboardSections}
                selectedSection={selectedDashboardSection}
                selectedItem={selectedDashboardItem}
                width={mainWidth}
                height={contentHeight}
                theme={theme}
              />
            )
          ) : view === 'settings' ? (
            <VirtualList
              title="Themes"
              items={themeItems}
              width={mainWidth}
              height={contentHeight}
              isActive={focus === 'main'}
              theme={theme}
              onSelect={(item) => {
                const nextConfig = {
                  ...config,
                  ui: { ...config.ui, theme: item.id },
                };
                saveConfig(nextConfig);
                setConfig(nextConfig);
              }}
            />
          ) : view === 'ai' ? (
            <Box flexDirection="column" height={contentHeight} paddingX={1}>
              <Text color={theme.accent} bold>
                {aiMode === 'summary' ? '󰊤 AI Summary' : '󰍉 AI Review'}
              </Text>
              <Box marginTop={1}>
                {aiStatus === 'loading' ? (
                  <Spinner label={`Generating ${aiMode}...`} theme={theme} />
                ) : aiStatus === 'error' ? (
                  <ErrorMessage
                    title="AI Generation Failed"
                    message={aiError ?? 'Unknown error'}
                    suggestion="Check your AI provider configuration"
                    theme={theme}
                  />
                ) : aiEditing ? (
                  <Text>{aiDraft || ' '}</Text>
                ) : (
                  <Text>{aiText || ' '}</Text>
                )}
              </Box>
            </Box>
          ) : view === 'files' ? (
            <FileTree
              title="Changed Files"
              files={sampleFiles}
              width={mainWidth}
              height={contentHeight}
              isActive={focus === 'main'}
              theme={theme}
              onSelect={(file) => {
                // Jump to file in diff
                setView('diff');
              }}
            />
          ) : status === 'loading' ? (
            <Box paddingX={1} height={contentHeight}>
              <Spinner label="Loading pull requests..." theme={theme} />
            </Box>
          ) : status === 'error' ? (
            <Box paddingX={1} height={contentHeight}>
              <ErrorMessage
                title="Failed to load pull requests"
                message={errorMessage ?? 'Unknown error occurred'}
                suggestion="Check your network connection and try again"
                theme={theme}
              />
            </Box>
          ) : view === 'list' ? (
            <Box flexDirection="column">
              <VirtualList
                title="Pull Requests"
                items={items}
                width={mainWidth}
                height={listHeight}
                isActive={focus === 'main'}
                theme={theme}
                onSelect={(_item, index) => {
                  setSelectedIndex(index);
                  setView('diff');
                  const pr = pullRequests[index];
                  if (!pr || !providerContext) {
                    setDiffText(SAMPLE_DIFF);
                    setDiffStatus('idle');
                    setDiffError(null);
                    return;
                  }

                  setDiffStatus('loading');
                  setDiffError(null);
                  const { provider: providerType, token, baseUrl, repo: repoRef } = providerContext;
                  const client = createProvider({ type: providerType, token, baseUrl });
                  const { owner, repo: repoName } = parseRepo(repoRef, providerType);
                  client
                    .getPullRequestDiff(owner, repoName, pr.number)
                    .then(async (diff) => {
                      const processed = await processDiff(diff || SAMPLE_DIFF);
                      setDiffText(processed || SAMPLE_DIFF);
                      setDiffStatus('idle');
                    })
                    .catch((err) => {
                      setDiffText(SAMPLE_DIFF);
                      setDiffStatus('error');
                      setDiffError(err instanceof Error ? err.message : String(err));
                    });
                }}
              />
              {/* Detail preview */}
              <Box height={detailHeight} borderStyle="single" borderColor={theme.border}>
                <DiffView
                  title={items[selectedIndex]?.title ?? 'Preview'}
                  diffText={diffText}
                  width={mainWidth - 2}
                  height={detailHeight - 2}
                  isActive={focus === 'detail'}
                  theme={theme}
                />
              </Box>
            </Box>
          ) : (
            <DiffView
              title={`${items[selectedIndex]?.title ?? 'Diff'}`}
              diffText={diffText}
              width={mainWidth}
              height={contentHeight}
              isActive={focus === 'main'}
              theme={theme}
            />
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      <StatusBar
        bindings={statusBindings}
        chordBuffer={chordState.buffer}
        pendingChords={chordState.pendingChords}
        rightText={`${view === 'dashboard' ? 'Dashboard' : view === 'list' ? 'PR List' : view === 'diff' ? 'Diff' : view === 'files' ? 'Files' : view === 'ai' ? 'AI' : 'Settings'}${demoMode ? ' • Demo' : ''}`}
        theme={theme}
        width={width}
      />
    </Box>
  );
}
