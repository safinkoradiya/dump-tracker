import { useState, useEffect, useCallback } from 'react';

export function useApi(fetchFn, deps = []) {
  const [data, setData]       = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn();
      setResponse(res);
      setData(res.data ?? res);
    } catch (e) {
      setResponse(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, response, loading, error, reload: load };
}
