import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  /** Re-run the loader manually (e.g. after a mutation). */
  reload: () => void
  /** Replace the local data without a network round-trip (optimistic UI). */
  setData: (updater: T | ((prev: T | null) => T)) => void
}

/**
 * Run an async loader and expose {data, loading, error} with a stable reload.
 *
 * The loader is keyed by `deps`; changing them re-runs the fetch. Results from
 * stale runs are ignored so out-of-order responses can't overwrite fresh data.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) =>
      typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater,
    )
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    loader()
      .then((result) => {
        if (active) setDataState(result)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  return { data, loading, error, reload, setData }
}
