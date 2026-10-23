# Firma de código y avisos de Windows

Windows no marca a Check Space como virus: lo que muestra es un aviso de **SmartScreen**
("Windows protegió tu PC") porque el ejecutable **no está firmado** y todavía no tiene
reputación de descargas. Defender solo interviene si detecta un patrón sospechoso; un
binario sin firmar de un editor desconocido es el caso típico de falsa alarma.

Este documento explica qué se ha preparado en el repositorio y qué falta por hacer cuando
compres un certificado.

## Estado actual

- **Sin firmar.** No hay certificado configurado, así que SmartScreen seguirá avisando.
- El pipeline ya está listo: en cuanto existan los secretos `CSC_LINK` y
  `CSC_KEY_PASSWORD`, cada release sale firmada y con sello de tiempo.
- Se ha eliminado `-c.win.signAndEditExecutable=false` del script `package`. Esa opción
  impedía que electron-builder escribiera el icono, el nombre del producto, la versión y
  el editor dentro del `.exe`: justo los metadatos que SmartScreen y Defender usan para
  decidir si un binario es legítimo.
- El icono ahora es un `.ico` multirresolución (16–256 px) en lugar de un PNG de 256 px,
  para que el instalador, el acceso directo y la barra de tareas usen el tamaño nativo.

## Qué mejora cada cosa

| Medida | Efecto |
|---|---|
| Firma Authenticode válida | Quita el aviso de "editor desconocido" y permite verificar quién publica |
| Sello de tiempo (timestamp) | La firma sigue siendo válida después de caducar el certificado |
| Metadatos del `.exe` (nombre, versión, editor, icono) | Coherencia entre versiones y menos heuristicas de "binario anónimo" |
| `appId` y `publisherName` estables | Windows reconoce las actualizaciones como el mismo producto |
| Muchas descargas desde el mismo binario | SmartScreen gana reputación con el tiempo |

La reputación de SmartScreen es **por binario y por certificado**: cada versión nueva
empieza con poca reputación, aunque el editor ya sea conocido. Un certificado EV suele
dar reputación inmediata; uno OV la va ganando con las descargas.

## Opciones de certificado

| Opción | Coste orientativo | Ventajas | Inconvenientes |
|---|---|---|---|
| **Certificado OV** (Sectigo, DigiCert, SSL.com…) | ~200–400 €/año | Firma estándar, válida para SmartScreen | La clave privada debe estar en un token/HSM desde 2023; muchos emisores ofrecen firma en la nube |
| **Certificado EV** | ~300–600 €/año | Reputación de SmartScreen inmediata en la mayoría de casos | Más caro y con verificación de identidad más estricta |
| **Azure Artifact Signing** (antes Trusted Signing) | Desde ~10 USD/mes | Sin token físico, integración CI sencilla | Requiere suscripción de Azure y validación de identidad; la elegibilidad para personas físicas y organizaciones cambia, comprueba los requisitos vigentes |
| **Microsoft Store** | Gratis | Firma y distribución gestionadas por Microsoft | Otro canal de distribución y sus propios requisitos |

Si el proyecto lo publica una persona física sin empresa, el camino más simple suele ser
un certificado OV con firma en la nube del propio emisor.

## Activar la firma en GitHub Actions

1. Compra el certificado y exporta el `.pfx` (o descarga el paquete de firma en la nube
   que indique el emisor).
2. Pasa el `.pfx` a base64:

   ```bash
   base64 -w0 mi-certificado.pfx > csc-link.txt
   ```

   En macOS: `base64 -i mi-certificado.pfx -o csc-link.txt`.

3. En GitHub → *Settings* → *Secrets and variables* → *Actions*, crea:
   - `CSC_LINK`: el contenido de `csc-link.txt` (o una URL firmada al `.pfx`).
   - `CSC_KEY_PASSWORD`: la contraseña del `.pfx`.
4. Lanza el workflow *Release*. El paso **Configure code signing** detecta el secreto y
   electron-builder firma el instalador y el portable con SHA-256 y sello de tiempo.

Nunca subas el `.pfx` ni la contraseña al repositorio: solo van en los secretos.

### Firma local

```powershell
$env:CSC_LINK = "C:\ruta\certificado.pfx"
$env:CSC_KEY_PASSWORD = "contraseña"
npm run package
```

## Comprobar la firma

```powershell
$exe = Get-ChildItem .\build -Filter *.exe | Select-Object -First 1
Get-AuthenticodeSignature $exe.FullName | Format-List Status, StatusMessage, SignerCertificate
```

`Status` debe ser `Valid`. También sirve:

```powershell
signtool verify /pa /v $exe.FullName
```

El workflow ejecuta esta comprobación y **falla el release** si algún `.exe` no queda
correctamente firmado. Además publica `SHA256SUMS.txt` junto a los instaladores para que
cualquiera pueda verificar la descarga:

```powershell
Get-FileHash .\build\*.exe -Algorithm SHA256
```

## Si Defender detecta un falso positivo

1. Comprueba el binario en <https://www.virustotal.com> (nunca subas el `.pfx`).
2. Envía el archivo a Microsoft: <https://www.microsoft.com/en-us/wdsi/filesubmission>
   (categoría *Software developer* → falso positivo). Suele resolverse en 24–72 h.
3. Si el aviso aparece en la web de descarga, revisa que el instalador esté firmado y que
   la versión publicada sea exactamente la compilada por el workflow.
4. Evita UPX y cualquier empaquetado que comprima el `.exe`: es una de las señales que más
   falsos positivos genera. Este proyecto no lo usa.

## Si usas Azure Artifact Signing

electron-builder 25 no firma con Artifact Signing de forma nativa. Dos alternativas:

- Ejecutar [`trusted-signing-cli`](https://github.com/azure/trusted-signing-cli) después de
  empaquetar, sobre cada `.exe` de `build/`.
- Usar el *sign hook* de electron-builder (`win.signtoolOptions.sign`) para delegar en
  `signtool` con las credenciales de Azure.

En ambos casos el paso **Verify signature** del workflow sigue siendo válido para
comprobar el resultado.

## Qué no hace la firma

Firmar no demuestra que el programa sea inocuo: demuestra **quién lo publicó** y que no se
ha modificado después. Por eso el código es abierto y las releases se compilan en GitHub
Actions a partir de este repositorio.
