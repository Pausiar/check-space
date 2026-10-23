# Revisión legal de Check Space

Estado de los puntos que afectan a la distribución de la aplicación y del sitio web.
No es asesoramiento jurídico: es una lista de comprobación para que nada quede al azar.

## Aplicación

| Punto | Estado |
|---|---|
| Licencia del código | **MIT** en [LICENSE](../LICENSE); el texto viaja en cada paquete (`resources/LICENSE.txt`) |
| Licencias de terceros | Documentadas en [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md); Electron incluye además las suyas |
| Datos personales | **Ninguno.** Sin cuentas, telemetría, analítica ni red; solo caché y preferencias locales ([PRIVACY.md](../PRIVACY.md)) |
| Borrado de archivos | Requiere selección y confirmación explícita; rutas críticas protegidas; aviso de irreversibilidad |
| Garantías | La licencia MIT excluye garantías; el aviso legal de la web incide en la copia de seguridad |
| Marcas de terceros | Se declara que no hay afiliación con Microsoft, WinDirStat ni TreeSize |
| Firma de código | **Pendiente de certificado**; pipeline preparado ([SIGNING.md](SIGNING.md)) |
| Nombre «Check Space» | **Sin comprobar.** Conviene buscar antecedentes en la EUIPO/OEPM antes de invertir en la marca |

## Sitio web (`check-space-docs`)

Los cambios están en el repositorio de la web (`check-space-docs`), en las páginas
legales, `_config.yml` y la portada. Resumen:

| Punto | Estado |
|---|---|
| Identificación del titular (art. 10 LSSICE) | Estructura creada en `_config.yml` → `legal:`; **faltan nombre, NIF, domicilio y email** |
| Política de privacidad (RGPD) | Responsable, finalidades, base jurídica, destinatarios, transferencias, conservación y derechos |
| Política de cookies (ePrivacy) | Almacenamiento propio y cookies de AdSense documentados; consentimiento previo real |
| Consentimiento | Aceptar y rechazar con la misma prominencia; se guarda versión y fecha; revocable desde el pie |
| Publicidad antes del consentimiento | **Eliminada**: AdSense solo se carga tras aceptar |
| Google Fonts | **Eliminado**: Inter se sirve desde el propio dominio (OFL en `assets/fonts/OFL.txt`) |
| Analítica | No hay |
| Afirmaciones comerciales | Retiradas las cifras no verificables (12 GB, 3× más lento, «< 10 s») |
| Contenido engañoso | Corregido: la app sí borra (con confirmación); macOS/Linux no están disponibles; SmartScreen se explica por la falta de firma |
| Enlaces de descarga | Apuntan a la última release, no a una versión congelada |
| Imagen social | PNG 1200×630 generado (las redes no renderizan SVG) |

## Pendiente (requiere decisiones o cuentas del titular)

1. **Datos del titular** en `_config.yml` (`owner`, `nif`, `address`, `email`). Mientras
   estén vacíos, las páginas muestran solo GitHub Issues.
2. **Certificado de firma** OV/EV o Azure Artifact Signing. Sin él, SmartScreen seguirá
   avisando en cada versión nueva.
3. **CMP certificada** (p. ej. Funding Choices) si se sirve publicidad a visitantes del
   EEE, Reino Unido o Suiza: Google la exige para esos territorios y el aviso actual no
   es una CMP certificada.
4. **Plazo de conservación de logs** de Vercel: fijarlo según el plan contratado y
   reflejarlo en la política de privacidad.
5. **Accesibilidad**: no hay obligación directa para este sitio, pero un repaso WCAG 2.2 AA
   (contraste, foco visible, navegación por teclado del aviso de cookies) es recomendable.
6. **Marca**: búsqueda de antecedentes antes de registrar el nombre.

## Al publicar una versión

- Actualizar `version` en `package.json` **y** `app.version` en `_config.yml`.
- Regenerar el icono si cambia el diseño (`node scripts/make-icon.mjs`).
- Revisar que `PRIVACY.md` siga siendo cierto: si algún día se añaden actualizaciones
  automáticas, analítica o informes de errores, hay que actualizarlo **antes** de activarlos.
