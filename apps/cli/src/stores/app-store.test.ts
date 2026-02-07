import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './app-store';

describe('AppStore', () => {
  beforeEach(() => {
    useAppStore.getState().reset();
  });

  describe('navigation', () => {
    it('should set view', () => {
      useAppStore.getState().setView('detail');
      expect(useAppStore.getState().currentView).toBe('detail');
    });

    it('should set panel', () => {
      useAppStore.getState().setPanel('sidebar');
      expect(useAppStore.getState().currentPanel).toBe('sidebar');
    });

    it('should set sidebar mode', () => {
      useAppStore.getState().setSidebarMode('filters');
      expect(useAppStore.getState().sidebarMode).toBe('filters');
    });
  });

  describe('selection', () => {
    it('should select repo and reset PR selection', () => {
      useAppStore.getState().selectPR(123);
      useAppStore.getState().selectRepo('owner', 'repo', 'github');
      
      expect(useAppStore.getState().selectedRepo).toEqual({
        owner: 'owner',
        repo: 'repo',
        provider: 'github',
      });
      expect(useAppStore.getState().selectedPRNumber).toBeNull();
      expect(useAppStore.getState().selectedListIndex).toBe(0);
    });

    it('should select PR and switch to detail view', () => {
      useAppStore.getState().selectPR(42);
      
      expect(useAppStore.getState().selectedPRNumber).toBe(42);
      expect(useAppStore.getState().currentView).toBe('detail');
    });

    it('should set selected list index', () => {
      useAppStore.getState().setSelectedListIndex(5);
      expect(useAppStore.getState().selectedListIndex).toBe(5);
    });
  });

  describe('UI state', () => {
    it('should toggle command palette', () => {
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(false);
      
      useAppStore.getState().toggleCommandPalette();
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(true);
      
      useAppStore.getState().toggleCommandPalette();
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(false);
    });

    it('should toggle help', () => {
      expect(useAppStore.getState().isHelpOpen).toBe(false);
      
      useAppStore.getState().toggleHelp();
      expect(useAppStore.getState().isHelpOpen).toBe(true);
    });

    it('should toggle sidebar', () => {
      expect(useAppStore.getState().isSidebarVisible).toBe(true);
      
      useAppStore.getState().toggleSidebar();
      expect(useAppStore.getState().isSidebarVisible).toBe(false);
    });
  });

  describe('filters', () => {
    it('should set search query', () => {
      useAppStore.getState().setSearchQuery('fix bug');
      expect(useAppStore.getState().searchQuery).toBe('fix bug');
    });

    it('should merge filters', () => {
      useAppStore.getState().setFilters({ state: 'open' });
      useAppStore.getState().setFilters({ author: 'alice' });
      
      expect(useAppStore.getState().filters).toEqual({
        state: 'open',
        author: 'alice',
      });
    });
  });

  describe('data', () => {
    it('should set pull requests', () => {
      const prs = [
        { id: '1', number: 1, title: 'PR 1', repo: 'test', author: 'alice', state: 'open' as const, sourceBranch: 'feature', targetBranch: 'main', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
      ];
      useAppStore.getState().setPullRequests(prs);
      expect(useAppStore.getState().pullRequests).toEqual(prs);
    });

    it('should set current diff', () => {
      const diff = 'diff --git a/file.ts b/file.ts\n-old\n+new';
      useAppStore.getState().setCurrentDiff(diff);
      expect(useAppStore.getState().currentDiff).toBe(diff);
    });
  });

  describe('status', () => {
    it('should set status', () => {
      useAppStore.getState().setStatus('loading');
      expect(useAppStore.getState().status).toBe('loading');
    });

    it('should set error message', () => {
      useAppStore.getState().setErrorMessage('Something went wrong');
      expect(useAppStore.getState().errorMessage).toBe('Something went wrong');
    });

    it('should set demo mode', () => {
      useAppStore.getState().setDemoMode(false);
      expect(useAppStore.getState().demoMode).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      useAppStore.getState().setView('detail');
      useAppStore.getState().selectRepo('owner', 'repo', 'github');
      useAppStore.getState().setSearchQuery('test');
      
      useAppStore.getState().reset();
      
      expect(useAppStore.getState().currentView).toBe('list');
      expect(useAppStore.getState().selectedRepo).toBeNull();
      expect(useAppStore.getState().searchQuery).toBe('');
    });
  });
});
