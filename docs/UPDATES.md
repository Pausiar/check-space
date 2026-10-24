# Actualizaciones dentro de la app

La versión instalada se actualiza sola con [`electron-updater`](https://www.electron.build/auto-update).
No hay servidor propio: el feed es la última release de GitHub.

## Cómo funciona

1. Al arrancar (20 s después) y cada 6 horas, `src/main/updater.js` consulta
   `latest.yml` de la última release.
2. Si la versión publicada es mayor, el panel de la barra de título ofrece
   descargarla. La descarga **no** es automática: la decide el usuario.
3. `electron-updater` descarga el instalador NSIS y su `.blockmap`, verifica el
   SHA-512 de `latest.yml` y aplica solo los bloques que cambiaron.
4. Al aceptar, `quitAndInstall()` instala la versión nueva y vuelve a abrir la
   app. Los análisis guardados y las preferencias se conservan.

Estados que puede mostrar la interfaz: comprobando, disponible, descargando
(con progreso), lista para instalar, al día y error.

## Limitaciones conocidas

- **Solo la versión instalada** (NSIS). La portable se ejecuta desde un `.exe`
  que no puede reemplazarse a sí mismo: el panel lo explica y no consulta el
  feed.
- **Solo Windows**: el proyecto no publica builds de macOS ni Linux.
- **Solo builds empaquetadas**: `npm run dev` muestra "no disponible" porque
  no existe `app-update.yml`.
- Si la release es privada haría falta un token; este repositorio es público,
  así que no se configura ninguno.
- La firma de código es independiente del updater, pero conviene tenerla: una
  actualización firmada por un editor desconocido también dispara SmartScreen.

## Qué debe contener cada release

`electron-builder.yml` declara el proveedor (`publish: github`) y el workflow
`.github/workflows/release.yml` publica, además de los `.exe`:

| Archivo | Para qué |
|---|---|
| `latest.yml` | Manifiesto que lee la app: versión, fecha, SHA-512 y nombre del instalador |
| `CheckSpace-Setup-<versión>.exe.blockmap` | Bloques del instalador; permite descargas diferenciales |

Sin `latest.yml` la app no ve la versión nueva, y sin `.blockmap` descarga el
instalador completo. El workflow comprueba que ambos existan antes de publicar
y falla si faltan.

## Publicar una versión

```bash
# 1. Sube la versión en package.json, docs/_config.yml y crea las notas
#    .github/release-notes/v1.2.1.md
npm version patch --no-git-tag-version   # o edita package.json a mano

git add -A && git commit -m "Release 1.2.1"
git push

# 2. Etiqueta: el push de la etiqueta dispara el workflow de release
git tag v1.2.1
git push origin v1.2.1
```

También se puede lanzar a mano desde **Actions → Release → Run workflow**: en
ese caso la etiqueta se crea a partir de la versión de `package.json`.

Lee el log del paso **Check update feed**: imprime el `latest.yml` generado. Si
el workflow falla ahí, la release no debe publicarse.

## Probar una actualización

1. Instala la versión publicada (por ejemplo 1.2.0).
2. Publica una 1.2.1 real.
3. Abre la app instalada y pulsa el botón de actualizaciones de la barra de
   título → **Buscar actualizaciones**.
4. Comprueba que aparece la 1.2.1, que el progreso avanza, que reiniciar
   instala la nueva versión y que la caché de análisis sigue ahí.

La comprobación desde `npm run dev` no sirve: está desactivada a propósito.
