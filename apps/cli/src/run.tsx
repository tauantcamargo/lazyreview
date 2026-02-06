import React from 'react';
import { render } from 'ink';
import { App, type AppProps } from './app';

export async function runTui(props: AppProps = {}): Promise<void> {
  render(<App {...props} />);
}
