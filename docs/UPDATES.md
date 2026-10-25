# Actualizaciones dentro de la app

La versión instalada se actualiza con [`electron-updater`](https://www.electron.build/auto-update).
No hay servidor propio: el feed es la última release de GitHub.

## Cómo funciona

1. Al arrancar (20 s después) y cada 6 horas, `src/main/updater.js` consulta el
   manifiesto de la última release: `latest.yml` en Windows y
   `latest-linux.yml` en Linux.
2. Si la versión publicada es mayor, el panel de la barra de título ofrece
   descargarla. La descarga **no** es automática: la decide el usuario.
3. En Windows, `electron-updater` descarga el instalador NSIS y su `.blockmap`,
   verifica el SHA-512 de `latest.yml` y aplica solo los bloques que cambiaron.
   En Linux descarga la nueva `.AppImage` (con su mapa de bloques incrustado) y
   sustituye el archivo al reiniciar.
4. Al aceptar, `quitAndInstall()` instala la versión nueva y vuelve a abrir la
   app. Los análisis guardados y las preferencias se conservan.

Estados que puede mostrar la interfaz: comprobando, disponible, descargando
(con progreso), lista para instalar, al día y error.

## Limitaciones conocidas

- **Windows: solo la versión instalada** (NSIS). La portable se ejecuta desde un
  `.exe` que no puede reemplazarse a sí mismo: el panel lo explica y no consulta
  el feed.
- **Linux: solo la AppImage** puede actualizarse desde la propia app. El `.deb`
  pertenece al gestor de paquetes: para pasar a otra versión hay que instalar el
  `.deb` nuevo con `sudo apt install ./CheckSpace-<versión>-amd64.deb` (o usar el
  gestor gráfico). El panel de actualizaciones no aparece en la versión `.deb`.
- **No hay builds de macOS.**
- **Solo builds empaquetadas**: `npm run dev` muestra "no disponible" porque
  no existe `app-update.yml`.
- Si la release es privada haría falta un token; este repositorio es público,
  así que no se configura ninguno.
- La firma de código es independiente del updater. En Windows conviene firmar:
  una actualización firmada por un editor desconocido también dispara
  SmartScreen. En Linux los paquetes no llevan firma; verifica el SHA-256.

### Firma y `publisherName`

Si `app-update.yml` lleva `publisherName`, `electron-updater` exige que el
instalador esté firmado por ese editor y **rechaza cualquier build sin firma**.
Por eso `win.publisherName` debe quedarse sin definir mientras las releases sean
sin firmar. Al configurar `CSC_LINK`, electron-builder lee el nombre del
certificado y lo escribe él solo; no hay que añadirlo a mano.

## Qué debe contener cada release

`electron-builder.yml` declara el proveedor (`publish: github`) y el workflow
`.github/workflows/release.yml` publica, además de los instaladores:

| Archivo | Para qué |
|---|---|
| `latest.yml` | Manifiesto de Windows: versión, fecha, SHA-512 y nombre del instalador |
| `CheckSpace-Setup-<versión>.exe.blockmap` | Bloques del instalador; permite descargas diferenciales en Windows |
| `latest-linux.yml` | Manifiesto de Linux: versión, fecha, SHA-512 y nombre de la AppImage |
| `CheckSpace-<versión>-x86_64.AppImage` | Aplicación portable de Linux que se actualiza sola |
| `CheckSpace-<versión>-amd64.deb` | Paquete para Debian/Ubuntu; se actualiza con el gestor de paquetes |

Sin `latest.yml` Windows no ve la versión nueva; sin `latest-linux.yml` la
AppImage tampoco. El workflow comprueba que los manifiestos existan antes de
publicar y falla si faltan. La AppImage lleva su mapa de bloques dentro del
propio archivo, por eso no se publica un `.blockmap` aparte para Linux.

## Publicar una versión

```bash
# 1. Sube la versión en package.json, docs/_config.yml y crea las notas
#    .github/release-notes/v1.2.1.md
npm version patch --no-git-tag-version   # o edita package.json a mano

git add -A && git commit -m "Release 1.2.1"
git push

# 2. Dispara el workflow: etiqueta o rama release/<versión>
git tag v1.2.1 && git push origin v1.2.1
git push origin HEAD:release/v1.2.1
```

Las tres formas (etiqueta, rama `release/<versión>` o **Actions → Release →
Run workflow**) crean la misma release: la etiqueta se resuelve de esta última
si no viene de un push de etiqueta. Al usar una rama, el paso *Point tag at this
commit* mueve la etiqueta al commit construido para que release y binarios
coincidan. El job `release` espera a que terminen Windows y Linux y publica una
sola release con todos los archivos.

Lee el log de los pasos **Check update feed** y **Check packages and update
feed**: imprimen los manifiestos generados. Si el workflow falla ahí, la release
no debe publicarse.

## Probar una actualización

### Windows

1. Instala la versión publicada (por ejemplo 1.2.0).
2. Publica una 1.2.1 real.
3. Abre la app instalada y pulsa el botón de actualizaciones de la barra de
   título → **Buscar actualizaciones**.
4. Comprueba que aparece la 1.2.1, que el progreso avanza, que reiniciar
   instala la nueva versión y que la caché de análisis sigue ahí.

### Linux (AppImage)

1. Descarga la AppImage publicada, dale permiso de ejecución y ábrela.
2. Publica una versión nueva.
3. Pulsa **Buscar actualizaciones**, descarga y reinicia.
4. Comprueba que se sustituyó la AppImage y que la caché de análisis sigue en
   `~/.config/disk-scanner`.

La comprobación desde `npm run dev` no sirve: está desactivada a propósito.
