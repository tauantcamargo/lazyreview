import React from 'react';
import { render } from 'ink';
import { App, type AppProps } from './app';
import { QueryProvider } from './providers/QueryProvider';

export async function runTui(props: AppProps = {}): Promise<void> {
  render(
    <QueryProvider>
      <App {...props} />
    </QueryProvider>
  );
}
