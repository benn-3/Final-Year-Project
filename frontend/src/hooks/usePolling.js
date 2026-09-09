import { useEffect, useRef } from 'react';

/**
 * Polls a status endpoint every `interval` ms until status is 'ready' or 'failed'.
 *
 * @param {() => Promise<{status: string}>} getStatus - async function that fetches status
 * @param {{ onReady: (data)=>void, onFailed: (data)=>void, interval?: number, enabled?: boolean }} opts
 */
export function usePolling(getStatus, { onReady, onFailed, interval = 1500, enabled = true }) {
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const poll = async () => {
      try {
        const data = await getStatus();
        if (!mountedRef.current) return;

        if (data.status === 'ready') {
          onReady?.(data);
        } else if (data.status === 'failed') {
          onFailed?.(data);
        } else {
          // still pending — schedule next poll
          timerRef.current = setTimeout(poll, interval);
        }
      } catch (err) {
        console.error('[usePolling] Error:', err.message);
        if (mountedRef.current) {
          timerRef.current = setTimeout(poll, interval * 2); 
        }
      }
    };

    timerRef.current = setTimeout(poll, interval);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled]);
}
