# Generador de itinerarios por ruta

Dado un vehículo/ruta de transporte escolar, genera enlaces de Google Maps con todas las paradas en orden (ida y, si existe, vuelta). Hay dos frontends sobre los mismos datos: una app de escritorio y una web estática.

## Datos
- Fuente: `EXCEL MESTRE LLULL.xlsx` (solo vive en este PC, ignorado por git; **nunca se sube**, el repo es público: Pipo42/Generador-itinerarios).
- `tools/build_data.py <xlsx> <salida>` lo convierte en `rutas.json`: una entrada por (vehículo, ruta base) con `centros`, `ida` y `vuelta` (null si no hay vuelta separada). Cada parada: `{n, lat, lon}`. Normaliza coordenadas con coma y quita sufijos `_Cn`/`__ANADA`/`__TORNADA` del nombre de ruta.
- `data/rutas.json` es la copia versionada que consume la web.
- **Actualizar datos web**: `Actualizar datos web.bat` regenera `data/rutas.json`, hace commit y push; GitHub Actions publica solo.

## Web (GitHub Pages)
- Código en `web/`: `index.template.html` (HTML/CSS/JS, contiene el marcador `/*__DATOS__*/[]`), `animaciones.js` (fondo de líneas discontinuas con puntos A/B y animación del bus al generar), `fonts/`, `favicon.png`.
- `tools/build_site.py` inyecta `rutas.json` en la plantilla y genera `site/` (autocontenido). `site/` está en `.gitignore`: es salida de build, no se edita a mano.
- `.github/workflows/deploy.yml` publica en Pages en cada push a `main` que toque `data/`, `tools/`, `web/` o el workflow.
- Probar en local: `mkdir site; cp data/rutas.json site/; python tools/build_site.py` y abrir `site/index.html`.

## App de escritorio
- `src/app.py` (tkinter) carga `rutas.json` empaquetado con PyInstaller (`sys._MEIPASS`) y abre Google Maps; trocea la URL si supera 2000 caracteres. `src/icono.ico` es su icono.
- `Generador de itinerarios.exe` es el binario ya compilado (ignorado por git).
- `src/build_data.py` y `src/rutas.json` son copias antiguas de `tools/build_data.py` y `data/rutas.json` (sin versionar): la fuente de verdad está en `tools/` y `data/`.

## Otros
- `bocetos/`: prototipos HTML de animaciones de fondo (sin versionar); el diseño elegido ya está integrado en `web/animaciones.js`.
- `pin.png`: recurso gráfico suelto, sin versionar.

## Convenciones
- Idioma: español en UI, comentarios y commits (mensajes tipo `Web: …`).
- Commits sin `Co-Authored-By: Claude`; autor con correo noreply.
