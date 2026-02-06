import { getConfigPath, loadConfig, saveConfig, DEFAULT_CONFIG } from '@lazyreview/core';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export function showConfig(): void {
  const config = loadConfig();
  console.log(JSON.stringify(config, null, 2));
}

export function configPath(): void {
  console.log(getConfigPath());
}

export function editConfig(): void {
  const editor = process.env.EDITOR || 'vi';
  const path = getConfigPath();
  if (!existsSync(path)) {
    saveConfig(DEFAULT_CONFIG);
  }
  spawnSync(editor, [path], { stdio: 'inherit' });
}
