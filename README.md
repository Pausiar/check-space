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
- **Actualizaciones desde la propia app**: comprueba GitHub Releases, descarga la versión nueva y la instala al reiniciar, sin volver a descargar el instalador. Solo la versión instalada; la portable se sustituye a mano.
- Tema claro / oscuro / del sistema.
- Disponible en **español, inglés, portugués (Brasil), francés, alemán, italiano, ruso, japonés, chino simplificado, polaco, turco, coreano y neerlandés**; el idioma se detecta del sistema y se puede cambiar desde la barra de título.

## Licencia y privacidad

- Código bajo licencia **MIT** ([LICENSE](LICENSE)).
- La aplicación **no recoge datos ni envía información sobre tus archivos**. La única conexión
  es la búsqueda de actualizaciones en GitHub: privacidad explicada en [PRIVACY.md](PRIVACY.md).
- Licencias de los componentes incluidos: [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Revisión legal y puntos pendientes: [docs/LEGAL.md](docs/LEGAL.md).
- El aviso de licencia y el de privacidad se incluyen en cada paquete (`resources/LICENSE.txt`
  y `resources/PRIVACY.txt`).
- Páginas legales del sitio web: [aviso legal](https://pausiar.github.io/check-space/aviso-legal/),
  [privacidad](https://pausiar.github.io/check-space/politica-privacidad/) y
  [cookies](https://pausiar.github.io/check-space/politica-cookies/).

## Web

El sitio público está en <https://pausiar.github.io/check-space/> y su código vive en
[`docs/`](docs/README.md). GitHub Pages lo publica directamente desde esa carpeta: al
activarlo, la portada es `docs/index.html` y no un README renderizado. Los cambios de la
web se hacen en el mismo repositorio que la aplicación.

## Actualizaciones

La versión instalada se actualiza sola con `electron-updater`: al arrancar consulta el feed
de GitHub (`latest.yml` de la última release), descarga el instalador NSIS con su
`.blockmap` —solo los bloques que cambiaron— y lo aplica al reiniciar. El panel de
actualizaciones de la barra de título permite comprobar a mano, ver el progreso y
reiniciar. La versión portable no puede reemplazarse a sí misma y lo indica en su
interfaz. Detalles del pipeline y de los archivos que debe subir cada release en
[docs/UPDATES.md](docs/UPDATES.md).

## Firma de código

Las releases se pueden firmar con un certificado Authenticode. Sin firma, Windows
SmartScreen avisa de "editor desconocido" aunque el binario sea legítimo. El pipeline ya
está preparado: añade los secretos `CSC_LINK` y `CSC_KEY_PASSWORD` y cada release saldrá
firmada y con sello de tiempo. Instrucciones, opciones de certificado y cómo resolver
falsos positivos de Defender en [docs/SIGNING.md](docs/SIGNING.md).

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
                  # requiere Windows o Wine: se incrustan icono, versión y editor en el .exe
node scripts/make-icon.mjs   # regenera resources/icon.png (1024 px) y resources/icon.ico (16–256 px)
```

Para añadir un idioma, crea `src/renderer/src/i18n/locales/<código>/` con los mismos archivos y claves que `es/` y añádelo a `LANGUAGES` en `src/renderer/src/i18n/index.jsx`. Las claves ausentes caen al español, pero conviene mantener los diccionarios completos: `npm run build` falla si un archivo tiene un error de sintaxis. Los plurales usan `Intl.PluralRules`: además de `_one` y `_other` puedes definir `_few` (ruso y polaco, 2-4) y `_many`; si faltan, se usa `_other`.
