import { useEffect, useRef, useState } from "react";

/** Run `fn` every `ms` while `active`. */
export function useInterval(fn: () => void, ms: number, active = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => ref.current(), ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}

/** Load data once (or when deps change); returns [data, error, loading, reload]. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fnRef.current()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e: unknown) => { if (alive) setError(e); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return { data, error, loading, reload: () => setTick((n) => n + 1), setData };
}

/** Seconds since `startMs` (or 0 when null), updated once a second. */
export function useElapsed(startMs: number | null, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useInterval(() => setNow(Date.now()), 1000, running && startMs !== null);
  return startMs === null ? 0 : Math.max(0, Math.floor((now - startMs) / 1000));
}

/** Focus management: returns a ref and a function that focuses the element. */
export function useFocusRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  return [ref, () => ref.current?.focus()] as const;
}
