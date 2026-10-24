import { HardDrive, Sun, Moon, Monitor, Languages } from 'lucide-react'
import { useTheme } from '../theme/ThemeProvider'
import { useI18n, LANGUAGES } from '../i18n'
import UpdateButton from './UpdateButton'

const THEME_OPTIONS = [
  { mode: 'light', icon: Sun },
  { mode: 'system', icon: Monitor },
  { mode: 'dark', icon: Moon }
]

/**
 * The only draggable area of the window. Everything interactive lives in
 * .titlebar-controls, which is explicitly no-drag; nothing else in the app
 * uses -webkit-app-region, so clicks are never swallowed by the window frame.
 */
export default function TitleBar() {
  const { mode, setMode } = useTheme()
  const { t, lang, setLang } = useI18n()

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <HardDrive size={15} strokeWidth={2} />
        <span>Check Space</span>
      </div>
      <div className="titlebar-controls">
        <UpdateButton />
        <label className="lang-select" title={t('common.language')}>
          <Languages size={14} />
          <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label={t('common.language')}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <div className="theme-switch" role="radiogroup" aria-label={t('common.theme')}>
          {THEME_OPTIONS.map(({ mode: m, icon: Icon }) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              className={`theme-switch-btn ${mode === m ? 'active' : ''}`}
              onClick={() => setMode(m)}
              title={t(`common.theme_${m}`)}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
