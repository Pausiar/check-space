# Web de Check Space

Sitio público de la aplicación, servido con **GitHub Pages** desde esta carpeta.
Es Jekyll: las páginas son HTML con front matter y la plantilla común está en
`_layouts/default.html`.

## Puesta en marcha (una sola vez)

En GitHub, **Settings → Pages → Build and deployment**:

- **Source**: `Deploy from a branch`
- **Branch**: `main` y carpeta **`/docs`**

Con eso cada push a `main` publica la web en
<https://pausiar.github.io/check-space/>. `docs/index.html` es la portada, así que
GitHub no renderiza ningún README como página principal.

No hace falta workflow: Pages compila el Jekyll del repositorio con el gem
`github-pages`, que ya incluye los dos plugins declarados en `_config.yml`
(`jekyll-seo-tag` y `jekyll-sitemap`). Por eso no se versiona `Gemfile`: Pages lo
ignora y mantener uno solo añade ruido.

## Direcciones

`_config.yml` define la dirección pública:

```yaml
url: "https://pausiar.github.io"
baseurl: "/check-space"
```

Como el sitio vive en un subdirectorio del dominio, `baseurl` no puede quedar
vacío. Todos los enlaces internos usan los filtros `relative_url` /
`absolute_url`; no escribas rutas absolutas a mano (`/assets/...`) o se romperán.
Si algún día se usa un dominio propio, cambia `url` y deja `baseurl: ""`.

## Previsualizar en local

```bash
gem install jekyll jekyll-seo-tag jekyll-sitemap
cd docs
jekyll serve --baseurl ""
```

Abre <http://127.0.0.1:4000/>. Sin `--baseurl ""` las rutas apuntarían a
`/check-space/`, que en local no existe.

## Publicar cambios

1. Edita las páginas o los datos de `_config.yml`.
2. Comprueba que no queden cifras sin verificar ni afirmaciones que la app no cumpla.
3. Commit y push a `main`; Pages reconstruye en un par de minutos.

## Datos del titular

El artículo 10 de la LSSICE obliga a identificar al titular. Rellena en
`_config.yml`:

```yaml
legal:
  owner: "Nombre o razón social"
  nif: "12345678Z"
  address: "Calle, número, CP, ciudad"
  email: "contacto@ejemplo.com"
```

Mientras estén vacíos, las páginas legales muestran solo el enlace a GitHub
Issues. Detalles y pendientes en [LEGAL.md](LEGAL.md).

## Ficheros que no son la web

`LEGAL.md`, `SIGNING.md` y `UPDATES.md` son documentación del repositorio, no
páginas del sitio. Están en `exclude` dentro de `_config.yml` para que Jekyll no
las publique. Al añadir documentación nueva a esta carpeta, añádela también a esa
lista.

## Notas

- `ads.txt` solo tiene efecto en la raíz de un dominio. En
  `pausiar.github.io/check-space/` Google no lo leerá: si AdSense pasa a ser
  importante, hará falta un dominio propio.
- `robots.txt`, `llms.txt` y el sitemap se generan con la dirección configurada;
  no contienen URL escritas a mano.
- El aviso de cookies guarda la elección en `localStorage` y solo carga AdSense
  tras aceptar.
