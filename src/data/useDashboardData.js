import { useCallback, useEffect, useState } from 'react';
import { loadDashboardData } from './source.js';

/** Loads dashboard data and reports { status: 'loading' | 'error' | 'ready', data, error, retry }. */
export function useDashboardData() {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading', data: null, error: null });
    loadDashboardData()
      .then((data) => live && setState({ status: 'ready', data, error: null }))
      .catch((error) => live && setState({ status: 'error', data: null, error }));
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
