# Privacidad de Check Space (aplicación)

**Última actualización: octubre de 2026**

Check Space es un analizador de espacio en disco que funciona **íntegramente en tu
equipo**. Esta política cubre la aplicación de escritorio; la del sitio web está en
<https://check-space-docs.vercel.app/politica-privacidad/>.

## Resumen

- No hay cuentas, registro ni inicio de sesión.
- No hay telemetría, analítica ni informes de fallos.
- La aplicación **no realiza peticiones de red**. Puedes usarla sin conexión.
- Tus archivos, nombres de archivo y tamaños no salen de tu ordenador.

## Qué datos se guardan y dónde

La aplicación guarda únicamente datos locales, necesarios para recordar su estado:

| Dato | Ubicación | Finalidad |
|---|---|---|
| Caché del último análisis de cada unidad o carpeta (nombres, rutas y tamaños) | `%APPDATA%\Check Space` | Mostrar los resultados sin volver a escanear |
| Idioma y tema elegidos | Almacenamiento local de la ventana (Chromium) | Recordar tus preferencias |

Puedes borrar esos datos en cualquier momento cerrando la aplicación y eliminando la
carpeta `%APPDATA%\Check Space`, o desinstalándola con el desinstalador de Windows.

## Acceso al sistema

Para medir el espacio, la aplicación necesita leer metadatos de archivos (nombre, ruta,
tamaño, fechas) y usar la Papelera de reciclaje de Windows cuando tú lo pides. En Windows
invoca `powershell.exe` localmente para enumerar unidades y, si lo solicitas, para
reiniciarse con permisos de administrador. **Ninguna de esas llamadas envía datos fuera
del equipo.**

Los archivos solo se eliminan cuando tú seleccionas elementos y confirmas la acción. La
aplicación nunca borra, mueve ni sube archivos por su cuenta.

## Servicios de terceros

La aplicación no integra SDK de terceros, publicidad ni rastreo. Las descargas se
distribuyen a través de GitHub Releases; esa descarga la realiza tu navegador, no la
aplicación, y se rige por la política de privacidad de GitHub.

## Menores

La aplicación no recoge datos de ninguna persona, incluidos menores de edad.

## Cambios

Si en el futuro la aplicación incorporase alguna función que implique tratamiento de
datos (por ejemplo, actualizaciones automáticas o informes de errores), esta política se
actualizará **antes** de activarla y se pedirá consentimiento cuando la ley lo exija.

## Contacto

Dudas o solicitudes: <https://github.com/Pausiar/check-space/issues>.

---

# Check Space privacy notice (application)

**Last updated: October 2026**

Check Space runs **entirely on your computer**. This notice covers the desktop app; the
website notice is at <https://check-space-docs.vercel.app/politica-privacidad/>.

- No account, sign-up or login.
- No telemetry, analytics or crash reporting.
- The app makes **no network requests** and works offline.
- Your files, file names and sizes never leave your machine.

The only data stored is local: a per-drive scan cache (file names, paths and sizes) in
`%APPDATA%\Check Space`, plus your language and theme preferences in the window's local
storage. Delete that folder, or uninstall the app, to remove it.

The app reads file metadata and uses the Windows Recycle Bin when you ask it to. It calls
`powershell.exe` locally to list drives and, on request, to relaunch elevated. None of
those calls send data anywhere. Files are only deleted after you select them and confirm;
the app never deletes, moves or uploads anything on its own.

Downloads are served by GitHub Releases, so the download itself follows GitHub's privacy
policy. Questions: <https://github.com/Pausiar/check-space/issues>.
