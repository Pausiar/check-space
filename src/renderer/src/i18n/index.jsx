import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

// ============================================
// i18n
// ============================================
// Each feature keeps its strings in its own namespace file:
//   locales/<lang>/<namespace>.js  ->  export default { key: 'text' }
// and uses them as t('<namespace>.<key>', { vars }).
//
// Interpolation: 'Hola {name}'.
// Plurals: pass { count } and define '<key>_one' / '<key>_other'.

const modules = import.meta.glob('./locales/*/*.js', { eager: true })

const dictionaries = {}
for (const [file, mod] of Object.entries(modules)) {
  const [, lang, ns] = /\.\/locales\/([^/]+)\/([^/]+)\.js$/.exec(file)
  dictionaries[lang] = dictionaries[lang] || {}
  dictionaries[lang][ns] = mod.default
}

export const LANGUAGES = [
  { code: 'es', label: 'Español', locale: 'es-ES' },
  { code: 'en', label: 'English', locale: 'en-US' },
  { code: 'pt-BR', label: 'Português (Brasil)', locale: 'pt-BR' },
  { code: 'fr', label: 'Français', locale: 'fr-FR' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE' },
  { code: 'it', label: 'Italiano', locale: 'it-IT' }
]
const FALLBACK = 'es'
const STORAGE_KEY = 'language'

function resolveKey(lang, key) {
  const dot = key.indexOf('.')
  if (dot < 0) return undefined
  const ns = dictionaries[lang]?.[key.slice(0, dot)]
  return ns ? ns[key.slice(dot + 1)] : undefined
}

function lookup(lang, key, vars) {
  if (vars && typeof vars.count === 'number') {
    const pluralKey = `${key}_${vars.count === 1 ? 'one' : 'other'}`
    const p = resolveKey(lang, pluralKey) ?? resolveKey(FALLBACK, pluralKey)
    if (p !== undefined) return p
  }
  return resolveKey(lang, key) ?? resolveKey(FALLBACK, key)
}

function interpolate(text, vars) {
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m))
}

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && dictionaries[saved]) return saved
  } catch {}
  // Match the full tag first (pt-BR, fr-FR…), then the base language so that
  // pt-PT also lands on the Portuguese dictionary and de-AT on German.
  const nav = (navigator.language || '').toLowerCase()
  const base = nav.slice(0, 2)
  const match =
    LANGUAGES.find((l) => l.locale.toLowerCase() === nav) ||
    LANGUAGES.find((l) => l.code.toLowerCase().split('-')[0] === base)
  return match && dictionaries[match.code] ? match.code : FALLBACK
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

function makeFormatters(locale, t) {
  const num = new Intl.NumberFormat(locale)
  const dec1 = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const pct = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const date = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  return {
    bytes(bytes) {
      if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
      const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
      const value = bytes / Math.pow(1024, i)
      return `${i === 0 ? num.format(value) : dec1.format(value)} ${UNITS[i]}`
    },
    number: (n) => num.format(n || 0),
    percent: (fraction) => pct.format(fraction || 0),
    date: (ms) => (ms ? date.format(new Date(ms)) : '—'),
    dateTime: (ms) => (ms ? dateTime.format(new Date(ms)) : '—'),
    /** "hace 3 días" / "3 days ago" */
    timeAgo(ms) {
      if (!ms) return '—'
      const diff = (ms - Date.now()) / 1000
      const abs = Math.abs(diff)
      if (abs < 60) return t('common.justNow')
      if (abs < 3600) return rel.format(Math.round(diff / 60), 'minute')
      if (abs < 86400) return rel.format(Math.round(diff / 3600), 'hour')
      if (abs < 86400 * 30) return rel.format(Math.round(diff / 86400), 'day')
      if (abs < 86400 * 365) return rel.format(Math.round(diff / (86400 * 30)), 'month')
      return rel.format(Math.round(diff / (86400 * 365)), 'year')
    }
  }
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLanguage)

  const setLang = useCallback((code) => {
    if (!dictionaries[code]) return
    setLangState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
    } catch {}
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo(() => {
    const locale = LANGUAGES.find((l) => l.code === lang)?.locale || 'es-ES'
    const num = new Intl.NumberFormat(locale)
    const t = (key, vars) => {
      const text = lookup(lang, key, vars)
      if (text === undefined) return key
      if (!vars) return text
      // Numbers are shown with the locale's digit grouping
      const shown = {}
      for (const k in vars) shown[k] = typeof vars[k] === 'number' ? num.format(vars[k]) : vars[k]
      return interpolate(text, shown)
    }
    return { lang, setLang, t, locale, fmt: makeFormatters(locale, t) }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** { t, fmt, lang, setLang, locale } */
export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
