# Privacidad de Check Space (aplicación)

**Última actualización: octubre de 2026**

Check Space es un analizador de espacio en disco que funciona **íntegramente en tu
equipo**. Esta política cubre la aplicación de escritorio; la del sitio web está en
<https://pausiar.github.io/check-space/politica-privacidad/>.

## Resumen

- No hay cuentas, registro ni inicio de sesión.
- No hay telemetría, analítica ni informes de fallos.
- Tus archivos, nombres de archivo, tamaños y estructura de carpetas no salen de tu ordenador.
- La única conexión a internet es la **búsqueda de actualizaciones** en GitHub Releases, que
  solo envía la petición habitual (versión instalada, sistema e IP) y nunca datos de tu disco.
  Sin conexión, el análisis funciona igual.

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
distribuyen a través de GitHub Releases.

Actualizaciones: al arrancar, y cada seis horas mientras la app está abierta, se consulta
el feed público de releases (`latest.yml`) para saber si hay una versión nueva. Esa
petición la hace la aplicación, no tu navegador, y GitHub ve la IP y la versión que
envía cualquier cliente HTTP; no incluye nombres de archivo, rutas ni tamaños. Si
aceptas la actualización, el instalador se descarga desde el mismo GitHub y se ejecuta
al reiniciar. Puedes usar la aplicación sin conexión: solo se pierde esa comprobación.
La versión portable no se actualiza sola y no consulta el feed.

En ambos casos se aplica la política de privacidad de GitHub.

## Menores

La aplicación no recoge datos de ninguna persona, incluidos menores de edad.

## Cambios

Si en el futuro la aplicación incorporase alguna función que implique un nuevo
tratamiento de datos (por ejemplo, informes de errores), esta política se actualizará
**antes** de activarla y se pedirá consentimiento cuando la ley lo exija. Las
actualizaciones descritas arriba solo consultan GitHub y no crean perfiles ni recogen
datos personales.

## Contacto

Dudas o solicitudes: <https://github.com/Pausiar/check-space/issues>.

---

# Check Space privacy notice (application)

**Last updated: October 2026**

Check Space runs **entirely on your computer**. This notice covers the desktop app; the
website notice is at <https://pausiar.github.io/check-space/politica-privacidad/>.

- No account, sign-up or login.
- No telemetry, analytics or crash reporting.
- Your files, file names, sizes and folder structure never leave your machine.
- The only internet request is the **update check** against GitHub Releases, which sends
  the usual HTTP request (installed version, OS and IP) and never any data from your
  disk. Without a connection, scanning works exactly the same.

The only data stored is local: a per-drive scan cache (file names, paths and sizes) in
`%APPDATA%\Check Space`, plus your language and theme preferences in the window's local
storage. Delete that folder, or uninstall the app, to remove it.

The app reads file metadata and uses the Windows Recycle Bin when you ask it to. It calls
`powershell.exe` locally to list drives and, on request, to relaunch elevated. None of
those calls send data anywhere. Files are only deleted after you select them and confirm;
the app never deletes, moves or uploads anything on its own.

Downloads are served by GitHub Releases. At startup, and every six hours while the app
is open, the app reads the public release feed (`latest.yml`) to see whether a newer
version exists; GitHub sees the IP and version sent by any HTTP client, never file
names, paths or sizes. If you accept the update, the installer is downloaded from the
same place and runs on restart. The portable build does not update itself and never
queries the feed. Both cases follow GitHub's privacy policy.

Questions: <https://github.com/Pausiar/check-space/issues>.
