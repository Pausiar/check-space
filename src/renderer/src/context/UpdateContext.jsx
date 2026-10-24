import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

/**
 * Update state shared by the title bar and its panel.
 *
 * status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' |
 *         'up-to-date' | 'error' | 'unsupported'
 * The main process owns the state machine; this only mirrors it so a component
 * that mounts late still receives the current snapshot.
 */
const UpdateContext = createContext(null)

export function UpdateProvider({ children }) {
  const [update, setUpdate] = useState(null)
  const api = window.api?.updates

  useEffect(() => {
    if (!api) return undefined
    let alive = true
    api
      .getState()
      .then((snapshot) => {
        if (alive && snapshot) setUpdate(snapshot)
      })
      .catch(() => {})
    const off = api.onStatus((snapshot) => {
      if (alive && snapshot) setUpdate(snapshot)
    })
    return () => {
      alive = false
      off?.()
    }
  }, [api])

  const check = useCallback(() => {
    api?.check().then((s) => s && setUpdate(s)).catch(() => {})
  }, [api])

  const download = useCallback(() => {
    api?.download().then((s) => s && setUpdate(s)).catch(() => {})
  }, [api])

  const install = useCallback(() => {
    api?.install()
  }, [api])

  const value = useMemo(() => ({ update, check, download, install }), [update, check, download, install])
  return <UpdateContext.Provider value={value}>{children}</UpdateContext.Provider>
}

export function useUpdate() {
  return useContext(UpdateContext) || { update: null, check: () => {}, download: () => {}, install: () => {} }
}
