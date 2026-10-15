import { useDashboardData } from '../data/useDashboardData.js';

export function Loading() {
  return (
    <div className="state" role="status" aria-live="polite">
      Loading data...
    </div>
  );
}

export function EmptyState({ title = 'No data', message }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <h2>Could not load the data</h2>
      <p>{error?.message || 'Something went wrong.'}</p>
      {onRetry && <button onClick={onRetry}>Try again</button>}
    </div>
  );
}

/** Handles loading and error, then renders children(data). */
export function DataGate({ children }) {
  const { status, data, error, retry } = useDashboardData();
  if (status === 'loading') return <Loading />;
  if (status === 'error') return <ErrorState error={error} onRetry={retry} />;
  return children(data);
}
