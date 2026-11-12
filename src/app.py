import json, sys, os, unicodedata, webbrowser
import tkinter as tk
from tkinter import ttk, messagebox

MAX_URL = 2000  # Google limita las URL a 2.048 caracteres


def recurso(nombre):
    base = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base, nombre)


def norm(s):
    s = unicodedata.normalize('NFD', s.lower())
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')


with open(recurso('rutas.json'), encoding='utf-8') as f:
    RUTAS = json.load(f)
for r in RUTAS:
    r['etiqueta'] = f"{r['vehiculo']}  ·  {r['ruta']}"
    r['clave'] = norm(r['etiqueta'])
ETIQUETAS = [r['etiqueta'] for r in RUTAS]


def urls_maps(paradas):
    """Un único enlace con todas las paradas. Solo se trocea si la URL superara el límite de longitud."""
    pts = [f"{p['lat']},{p['lon']}" for p in paradas]
    if len(pts) == 1:
        return ['https://www.google.com/maps/search/?api=1&query=' + pts[0]]
    base = 'https://www.google.com/maps/dir/'
    trozos, actual = [], []
    for p in pts:
        if actual and len(base) + sum(len(x) + 1 for x in actual + [p]) > MAX_URL:
            trozos.append(actual)
            actual = [actual[-1]]      # el final de un tramo es el inicio del siguiente
        actual.append(p)
    trozos.append(actual)
    return [base + '/'.join(t) + '/' for t in trozos]


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Generador de itinerario por ruta')
        try:
            self.iconbitmap(recurso('icono.ico'))
        except tk.TclError:
            pass
        self.geometry('720x520')
        self.minsize(560, 420)
        fr = ttk.Frame(self, padding=14)
        fr.pack(fill='both', expand=True)

        ttk.Label(fr, text='Ruta:').pack(anchor='w')
        self.var = tk.StringVar()
        self.cb = ttk.Combobox(fr, textvariable=self.var, values=ETIQUETAS, font=('Segoe UI', 11))
        self.cb.pack(fill='x', pady=(2, 8))
        self.cb.set('')
        self.cb.bind('<KeyRelease>', self.filtrar)
        self.cb.bind('<<ComboboxSelected>>', self.mostrar)
        self.cb.bind('<Return>', lambda e: self.generar())
        ttk.Label(fr, text='Escribe para filtrar (p. ej. v782 o R230_MAÓ3) o despliega la lista.',
                  foreground='#666').pack(anchor='w')

        self.centros = tk.StringVar(value='Centro(s): —')
        ttk.Label(fr, textvariable=self.centros, wraplength=680, font=('Segoe UI', 10, 'bold')
                  ).pack(anchor='w', pady=(10, 4))

        self.sentido = tk.StringVar(value='ida')
        fs = ttk.Frame(fr)
        fs.pack(anchor='w', pady=(0, 4))
        self.rb_ida = ttk.Radiobutton(fs, text='Ida', value='ida', variable=self.sentido, command=self.mostrar)
        self.rb_vuelta = ttk.Radiobutton(fs, text='Vuelta', value='vuelta', variable=self.sentido,
                                         command=self.mostrar)
        self.rb_ida.pack(side='left', padx=(0, 12))
        self.rb_vuelta.pack(side='left')

        self.lista = tk.Listbox(fr, font=('Segoe UI', 10), activestyle='none')
        self.lista.pack(fill='both', expand=True)

        self.btn = ttk.Button(fr, text='Generar itinerario', command=self.generar)
        self.btn.pack(pady=(10, 0), ipadx=20, ipady=4)
        self.cb.focus_set()

    def coincidencias(self):
        t = norm(self.var.get().strip())
        exacta = [r for r in RUTAS if t in (norm(r['etiqueta']), norm(r['ruta']), norm(r['vehiculo']))]
        if exacta:
            return exacta
        return [r for r in RUTAS if t in r['clave']] if t else []

    def filtrar(self, ev):
        if ev.keysym in ('Up', 'Down', 'Return', 'Escape', 'Tab', 'Left', 'Right'):
            return
        t = norm(self.var.get().strip())
        self.cb['values'] = [r['etiqueta'] for r in RUTAS if t in r['clave']] if t else ETIQUETAS
        self.mostrar()

    def mostrar(self, ev=None):
        m = self.coincidencias()
        self.lista.delete(0, 'end')
        hay_vuelta = len(m) == 1 and m[0]['vuelta'] is not None
        self.rb_vuelta.state(['!disabled'] if hay_vuelta else ['disabled'])
        if not hay_vuelta:
            self.sentido.set('ida')
        if len(m) == 1:
            r = m[0]
            self.centros.set('Centro(s): ' + ' | '.join(r['centros']))
            for i, p in enumerate(self.paradas(r), 1):
                self.lista.insert('end', f"{i:>2}. {p['n']}   ({p['lat']}, {p['lon']})")
        else:
            self.centros.set('Centro(s): —' if not m else f'{len(m)} rutas coinciden: elige una de la lista.')

    def paradas(self, r):
        return r['vuelta'] if self.sentido.get() == 'vuelta' and r['vuelta'] else r['ida']

    def generar(self):
        m = self.coincidencias()
        if not m:
            return messagebox.showwarning('Ruta', 'Elige una ruta válida.')
        if len(m) > 1:
            return messagebox.showinfo('Ruta', f'Hay {len(m)} rutas que coinciden. '
                                       'Elige una de la lista desplegable.')
        urls = urls_maps(self.paradas(m[0]))
        for u in urls:
            webbrowser.open_new_tab(u)
        if len(urls) > 1:
            messagebox.showinfo('Itinerario', f'La ruta es muy larga para un solo enlace: se han abierto '
                                f'{len(urls)} pestañas encadenadas (el final de una es el inicio de la siguiente).')


if __name__ == '__main__':
    App().mainloop()
