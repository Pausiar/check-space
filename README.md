# Check Space

Analizador de espacio en disco para Windows (Electron + React).

## Funciones

- Escaneo en paralelo de unidades (fijas y USB) o de cualquier carpeta.
- Mide también archivos de OneDrive, archivos deduplicados y archivos del sistema en uso (`pagefile.sys`, `hiberfil.sys`…); los hard links se cuentan una sola vez y los enlaces simbólicos/junctions no se siguen.
- Muestra el espacio "de sistema / no contabilizado" y las carpetas sin permiso, con opción de reiniciar como administrador.
- Mapa anidado (treemap) y gráfico de anillo, vista de lista con columnas ordenables, búsqueda con comodines y filtros.
- Archivos grandes, tipos de archivo por categoría, archivos antiguos.
- Duplicados verificados byte a byte (tamaño → huella de inicio/fin → SHA‑1 completo).
- Sugerencias de limpieza (temporales, papelera, cachés de navegadores, Windows Update, `node_modules`…).
- Borrado con confirmación (papelera o permanente), selección múltiple y actualización inmediata de los datos.
- Exportación a CSV (Excel) y JSON. Caché de resultados con fecha del último análisis.
- Tema claro / oscuro / del sistema e idioma español / inglés.

## Atajos de teclado

| Tecla | Acción |
|---|---|
| Retroceso / Alt+← | Subir un nivel |
| Supr / Mayús+Supr | Mover a la papelera / eliminar permanentemente la selección |
| Ctrl+F | Buscar |
| F5 / Ctrl+R | Volver a escanear |
| Ctrl+1 … Ctrl+7 | Cambiar de pestaña |

## Desarrollo

```bash
npm install
npm run dev       # modo desarrollo
npm run package   # instalador y ejecutable portable para Windows (carpeta build/)
node scripts/make-icon.mjs   # regenera resources/icon.png
```

Para añadir un idioma, crea `src/renderer/src/i18n/locales/<código>/` con los mismos archivos que `es/` y añádelo a `LANGUAGES` en `src/renderer/src/i18n/index.jsx`.
