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
- Tema claro / oscuro / del sistema.
- Disponible en **español, inglés, portugués (Brasil), francés, alemán e italiano**; el idioma se detecta del sistema y se puede cambiar desde la barra de título.

## Licencia y privacidad

- Código bajo licencia **MIT** ([LICENSE](LICENSE)).
- La aplicación **no recoge datos ni hace peticiones de red**: privacidad explicada en
  [PRIVACY.md](PRIVACY.md).
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

Para añadir un idioma, crea `src/renderer/src/i18n/locales/<código>/` con los mismos archivos y claves que `es/` y añádelo a `LANGUAGES` en `src/renderer/src/i18n/index.jsx`. Las claves ausentes caen al español, pero conviene mantener los diccionarios completos: `npm run build` falla si un archivo tiene un error de sintaxis.
