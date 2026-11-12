"""Genera site/index.html (autocontenido) a partir de web/index.template.html y site/rutas.json."""
import pathlib
import shutil

raiz = pathlib.Path(__file__).resolve().parent.parent
datos = (raiz / 'site' / 'rutas.json').read_text(encoding='utf-8')
html = (raiz / 'web' / 'index.template.html').read_text(encoding='utf-8')
assert '/*__DATOS__*/[]' in html
html = html.replace('/*__DATOS__*/[]', datos.replace('</', '<\\/'))
(raiz / 'site' / 'index.html').write_text(html, encoding='utf-8')
shutil.copy(raiz / 'web' / 'favicon.png', raiz / 'site' / 'favicon.png')
shutil.copytree(raiz / 'web' / 'fonts', raiz / 'site' / 'fonts', dirs_exist_ok=True)
(raiz / 'site' / 'rutas.json').unlink()
print('site/index.html generado')
