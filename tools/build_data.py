"""Lee el Excel y genera rutas.json (se incrusta en el .exe)."""
import json, re, sys
import pandas as pd

xlsx, out = sys.argv[1], sys.argv[2]
d = pd.read_excel(xlsx, sheet_name=0).dropna(subset=['VEHICLE'])
d.columns = ['VEH','PL','KM','ACO','PMR','ZONA','PAR','TRAJ','ORD','LAT','LON','H1','H2',
             'RUTA','CENTRE','COD','CTRL','CIF','EMP','CAM']

def num(v):
    if isinstance(v, str):
        v = v.replace(',', '.').replace(' ', '')   # '39, 56939' -> 39.56939
    return float(v)

d['LAT'] = d.LAT.map(num); d['LON'] = d.LON.map(num)
d['VEH'] = d.VEH.str.strip().str.upper()
d['BASE'] = (d.RUTA.str.strip().str.replace(r'_C\d+(?=__|$)', '', regex=True)
              .str.replace(r'__(ANADA|TORNADA)$', '', regex=True))
# TRAJECTE: 'ANADA I TORNADA' (ambos) / 'NOMÉS ANADA' / 'NOMÉS TORNADA'
d['SOLO_VUELTA'] = d.TRAJ.str.contains('TORNADA') & ~d.TRAJ.str.contains(' I ')


def paradas(g):
    g = g.drop_duplicates(['ORD', 'LAT', 'LON'])      # se respeta el orden del Excel
    return [{'n': p, 'lat': round(la, 6), 'lon': round(lo, 6)}
            for p, la, lo in zip(g.PAR.str.strip(), g.LAT, g.LON)]


rutas = []
for (veh, base), g in d.groupby(['VEH', 'BASE'], sort=False):
    centros = list(dict.fromkeys(g.CENTRE.str.strip()))
    vuelta = g[g.SOLO_VUELTA]
    ida = g[~g.SOLO_VUELTA]
    if ida.empty:                       # solo existe vuelta: se trata como ida
        ida, vuelta = vuelta, vuelta.iloc[0:0]
    rutas.append({'vehiculo': veh, 'ruta': base, 'centros': centros,
                  'ida': paradas(ida), 'vuelta': paradas(vuelta) if len(vuelta) else None})
json.dump(rutas, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
print(len(rutas), 'rutas;', sum(r['vuelta'] is not None for r in rutas), 'con vuelta separada')
