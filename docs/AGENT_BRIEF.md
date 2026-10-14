# Check Space — shared brief for implementation agents

Electron + React 19 + Vite (electron-vite) disk space analyzer for Windows ("Check Space").
Repo: /home/user/check-space. The main process (src/main/*) and preload are DONE — do not edit them.
Read these first: src/preload/index.js (the whole `window.api`), src/main/tree.js (`buildView`, `summarize`,
`search` define the data shapes), src/renderer/src/components/ScanView.jsx (how your component is mounted
and which props it receives), src/renderer/src/i18n/index.jsx, src/renderer/src/context/ScanContext.jsx,
src/renderer/src/context/FileActions.jsx (contract), src/renderer/src/utils/{paths,colors}.js, src/renderer/src/App.css.

## Data shapes returned by window.api.getView(path, { depth, maxChildren, metric, includeFiles })
- dir:    { type:'dir', name, path, size, alloc, files, dirs, mtime, error, childCount, children?: Entry[] }
          (`children` only present while depth allows; sorted desc by `metric`; `files`/`dirs` = counts in subtree)
- file:   { type:'file', name, path, size, alloc, mtime, ext, hardlink, locked }
          hardlink=true → its space is counted elsewhere, treat its value as 0 for charts/sums.
- other:  { type:'other', path, count, size, alloc }   (children beyond maxChildren merged)
- system: { type:'system', path, size, alloc }         (only among root children: unaccounted/system space)
`metric` is 'size' (logical) or 'alloc' (size on disk); always read values as entry[metric].
Paths of 'other'/'system' contain '\u0000' — they are NOT real paths; never pass them to file actions.
The tree lives in the main process; re-fetch whenever the `dataVersion` prop changes (scan end, deletion, cleanup).

## Rules
- Only create/edit the files you own (listed in your task). Other agents are editing other files in parallel
  in the same working tree. Do NOT run git commands that change state (no commit, checkout, stash, reset).
- No new npm dependencies unless your task explicitly allows it.
- UI text: never hardcode strings. Use `const { t, fmt } = useI18n()` from '../i18n'. Put your strings in your
  OWN namespace files `src/renderer/src/i18n/locales/es/<ns>.js` and `.../en/<ns>.js` (export default {...}),
  used as t('<ns>.key', vars). Spanish is the primary language (natural, Spain Spanish), English must be complete.
  Plurals: keys `x_one`/`x_other` + pass `{ count }`. Shared strings already exist in locales/*/common.js (read-only for you).
  Formatting: fmt.bytes(n), fmt.number(n), fmt.percent(fraction), fmt.date(ms), fmt.dateTime(ms), fmt.timeAgo(ms).
- Styling: put CSS in your own `.css` file next to your component and import it. Use the CSS variables from
  App.css (--bg-primary, --bg-secondary, --bg-hover, --text-primary/secondary/tertiary, --accent, --accent-light,
  --border, --danger, --danger-bg, --radius*, --shadow-*). Must look right in BOTH light and dark theme
  (data-theme="dark" on <html>); no hardcoded light-only colors. Reuse existing global classes where sensible
  (.btn-secondary, .btn-primary, .btn-danger-solid, .btn-icon, .btn-icon-sm, .btn-link, .segmented, .panel-empty,
  .file-list-panel, .file-list-header, .file-row, .file-info, .file-name, .file-path, .file-size, .file-actions).
- NEVER use `-webkit-app-region` (window dragging is handled only by the title bar; it used to break clicks).
- File actions (delete, reveal, context menu, selection) go through `useFileActions()` from '../context/FileActions'
  (see its contract). Deletion must always go through `requestDelete` (it confirms). Never call window.api.deletePaths directly
  unless you are the agent implementing FileActions.
- Keep code style consistent with the repo: plain JS/JSX, function components, no semicolons, 2-space indent, single quotes.
- Verify your work compiles: `cd /home/user/check-space && npx electron-vite build --outDir /tmp/<your-agent-name>-out`
  (use your own outDir so parallel builds don't collide). Fix every error in your files.
- When done, reply with: files created/changed, a short description of behavior, and anything the integrator must know
  (e.g. props you expect, assumptions about other components).
