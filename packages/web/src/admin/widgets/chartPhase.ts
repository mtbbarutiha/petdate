export type ChartWidgetPhase = 'ready' | 'loading' | 'error' | 'empty';

/**
 * A missing series while the dashboard request is in flight is not an empty chart.
 * Empty is only valid after the request settles with no series and no error.
 * A later refresh that already has series stays on the charts (`ready`).
 */
export function chartWidgetPhase(input: {
  loading: boolean;
  error?: string | null;
  hasSeries: boolean;
}): ChartWidgetPhase {
  if (input.hasSeries) return 'ready';
  if (input.loading) return 'loading';
  if (input.error) return 'error';
  return 'empty';
}
