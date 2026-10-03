import { LiveStoreProvider } from '@ft/live-client/react';
import { createScriptedStore } from '@ft/live-client/testing';
import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';

export { SAMPLE_FRAME as BASE_FRAME } from '@ft/live-client/testing';

/** Renders `ui` inside a live store whose stream the test plays. */
export function renderLive(ui: ReactNode) {
  const script = createScriptedStore();
  const view = render(<LiveStoreProvider store={script.store}>{ui}</LiveStoreProvider>);
  const inAct =
    <Args extends unknown[]>(step: (...args: Args) => void) =>
    (...args: Args) => {
      act(() => {
        step(...args);
      });
    };

  return {
    ...view,
    store: script.store,
    hello: inAct(script.hello),
    status: inAct(script.status),
    frame: inAct(script.frame),
    disconnect: inAct(script.disconnect),
  };
}
