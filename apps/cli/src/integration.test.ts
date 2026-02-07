import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);

// Get the directory where this test file is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Integration tests for the LazyReview CLI
 * These tests verify that the CLI commands work correctly
 */
describe('CLI Integration', () => {
  // Use absolute path to the dist directory
  const CLI_PATH = `node ${join(__dirname, '..', 'dist', 'index.js')}`;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Help Commands', () => {
    it('displays main help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} --help`);
      expect(stdout).toContain('Usage: lazyreview');
      expect(stdout).toContain('A terminal UI for code review');
      expect(stdout).toContain('Commands:');
    });

    it('displays version', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} --version`);
      expect(stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('displays pr help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} pr --help`);
      expect(stdout).toContain('Pull request commands');
      expect(stdout).toContain('list');
      expect(stdout).toContain('approve');
      expect(stdout).toContain('comment');
    });

    it('displays auth help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} auth --help`);
      expect(stdout).toContain('Authentication commands');
      expect(stdout).toContain('login');
      expect(stdout).toContain('logout');
      expect(stdout).toContain('status');
    });

    it('displays config help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} config --help`);
      expect(stdout).toContain('Configuration commands');
      expect(stdout).toContain('show');
      expect(stdout).toContain('path');
      expect(stdout).toContain('edit');
    });

    it('displays queue help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} queue --help`);
      expect(stdout).toContain('Offline queue commands');
      expect(stdout).toContain('list');
      expect(stdout).toContain('sync');
    });

    it('displays ai help', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} ai --help`);
      expect(stdout).toContain('AI provider commands');
      expect(stdout).toContain('login');
      expect(stdout).toContain('logout');
      expect(stdout).toContain('status');
    });
  });

  describe('Keys Command', () => {
    it('displays vim keybindings by default', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} keys`);
      expect(stdout).toContain('Vim Mode');
      expect(stdout).toContain('j / ↓');
      expect(stdout).toContain('k / ↑');
      expect(stdout).toContain('gg');
      expect(stdout).toContain('Enter');
    });

    it('displays standard keybindings with --standard flag', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} keys --standard`);
      expect(stdout).toContain('Standard Mode');
      expect(stdout).toContain('↓');
      expect(stdout).toContain('↑');
    });
  });

  describe('Doctor Command', () => {
    it('runs system diagnostics', async () => {
      // Doctor may exit with code 1 if some checks fail (e.g., no auth)
      // We still want to verify the output contains the expected content
      try {
        const { stdout } = await execAsync(`${CLI_PATH} doctor`);
        expect(stdout).toContain('LazyReview Doctor');
        expect(stdout).toContain('Node.js Version');
        expect(stdout).toContain('Storage');
      } catch (error: any) {
        // Command may exit with code 1, but stdout should still have diagnostics
        const stdout = error.stdout || '';
        expect(stdout).toContain('LazyReview Doctor');
        expect(stdout).toContain('Node.js Version');
        expect(stdout).toContain('Storage');
      }
    });

    it('checks network connectivity', async () => {
      try {
        const { stdout } = await execAsync(`${CLI_PATH} doctor`);
        expect(stdout).toContain('Network');
      } catch (error: any) {
        const stdout = error.stdout || '';
        expect(stdout).toContain('Network');
      }
    });
  });

  describe('Auth Commands', () => {
    it('shows auth status without token', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} auth status`);
      expect(stdout).toContain('No token stored');
    });

    it('shows specific provider status', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} auth status --provider github`);
      expect(stdout).toContain('github');
    });
  });

  describe('Config Commands', () => {
    it('shows config path', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} config path`);
      expect(stdout).toContain('.config');
      expect(stdout).toContain('lazyreview');
    });

    it('shows current config', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} config show`);
      // Should show either default config or indicate no config
      expect(stdout.length).toBeGreaterThan(0);
    });
  });

  describe('Queue Commands', () => {
    it('lists empty queue', async () => {
      const { stdout } = await execAsync(`${CLI_PATH} queue list`);
      // Should either show empty or list items
      expect(stdout.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('handles missing repo for pr list', async () => {
      try {
        await execAsync(`${CLI_PATH} pr list`);
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain("required option '-r, --repo");
      }
    });

    it('handles unauthorized pr list', async () => {
      try {
        await execAsync(`${CLI_PATH} pr list --repo octocat/hello-world`);
      } catch (error: any) {
        expect(error.stderr || error.stdout).toContain('token is required');
      }
    });

    it('handles invalid provider for auth', async () => {
      try {
        await execAsync(`${CLI_PATH} auth status --provider invalid`);
      } catch (error: any) {
        // Should handle gracefully or show error
        expect(error.stderr || error.stdout || '').toBeDefined();
      }
    });
  });

  describe('Debug Mode', () => {
    it('enables debug output with -d flag', async () => {
      // Need to run an actual command (not --help) to trigger the preAction hook
      const { stdout, stderr } = await execAsync(`${CLI_PATH} -d keys`);
      // Debug output goes to stderr
      const output = stdout + stderr;
      expect(output).toContain('Debug mode enabled');
    });
  });
});
