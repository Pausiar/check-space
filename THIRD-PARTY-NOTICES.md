# Avisos de terceros / Third-party notices

Check Space se distribuye bajo la licencia MIT (ver [LICENSE](LICENSE)). Incluye o
empaqueta los siguientes componentes de terceros, cada uno bajo su propia licencia:

## Incluidos en la aplicación empaquetada

| Componente | Licencia | Uso |
|---|---|---|
| [Electron](https://github.com/electron/electron) | MIT | Contenedor de la aplicación |
| Chromium | BSD 3-Clause y otras | Motor de renderizado incluido en Electron |
| Node.js | MIT | Runtime incluido en Electron |
| [React](https://github.com/facebook/react) | MIT | Interfaz de usuario |
| [React DOM](https://github.com/facebook/react) | MIT | Renderizado de la interfaz |
| [d3-hierarchy](https://github.com/d3/d3-hierarchy) | ISC | Cálculo del treemap |
| [d3-shape](https://github.com/d3/d3-shape) | ISC | Gráfico de anillo |
| [lucide-react](https://github.com/lucide-icons/lucide) | ISC | Iconos |

Electron incluye sus propios textos de licencia en la carpeta de instalación
(`LICENSE.electron.txt` y `LICENSES.chromium.html`); electron-builder los copia
automáticamente en cada paquete.

## Solo para desarrollo

| Componente | Licencia |
|---|---|
| [electron-vite](https://github.com/alex8088/electron-vite) | MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) | MIT |
| [Vite](https://github.com/vitejs/vite) | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | MIT |

## Marcas

Windows, Microsoft y OneDrive son marcas registradas de Microsoft Corporation. Check
Space es un proyecto independiente y **no está afiliado, patrocinado ni respaldado por
Microsoft**, ni por WinDirStat, TreeSize ni ninguna otra utilidad de disco. Los nombres de
terceros se citan únicamente con fines descriptivos.

---

# English summary

Check Space is MIT-licensed. It bundles Electron (MIT, including Chromium under
BSD 3-Clause and Node.js under MIT), React and React DOM (MIT), d3-hierarchy and d3-shape
(ISC) and lucide-react (ISC). Development-only tooling (electron-vite, electron-builder,
Vite, @vitejs/plugin-react) is MIT. Windows and OneDrive are trademarks of Microsoft
Corporation; this project is not affiliated with or endorsed by Microsoft.
