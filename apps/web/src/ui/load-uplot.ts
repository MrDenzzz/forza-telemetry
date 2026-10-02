import type uPlot from 'uplot';

let loading: Promise<typeof uPlot> | undefined;

/**
 * uPlot touches the DOM when imported, so charts load it in the browser, after mounting. The
 * import is shared, so a page of charts starts a single one.
 */
export function loadUPlot(): Promise<typeof uPlot> {
  loading ??= import('uplot').then((module) => module.default);
  return loading;
}
