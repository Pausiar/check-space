import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// mode: 'light' | 'dark' | 'system'
const STORAGE_KEY = 'theme'
const ThemeContext = createContext(null)

function initialMode() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
    // Migrate the old boolean setting
    if (localStorage.getItem('darkMode') === 'true') return 'dark'
  } catch {}
  return 'system'
}

const media = window.matchMedia('(prefers-color-scheme: dark)')

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(initialMode)
  const [systemDark, setSystemDark] = useState(media.matches)

  useEffect(() => {
    const onChange = (e) => setSystemDark(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const isDark = mode === 'dark' || (mode === 'system' && systemDark)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    window.api?.setTheme(isDark)
  }, [isDark])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode)
      localStorage.removeItem('darkMode')
    } catch {}
  }, [mode])

  const value = useMemo(() => ({ mode, setMode, isDark }), [mode, isDark])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/** { mode, setMode, isDark } */
export function useTheme() {
  return useContext(ThemeContext)
}
