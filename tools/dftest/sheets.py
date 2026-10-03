# Contact sheets from the PNGs genmap.ps1 writes into screenshots/df-maps/.
#   python tools/dftest/sheets.py
# Edit W (name -> save slot) and the sheet() calls at the bottom for a new set.
from PIL import Image, ImageDraw, ImageFont
import os
Image.MAX_IMAGE_PIXELS = None
DF = r'E:\SteamLibrary\steamapps\common\Dwarf Fortress'
OUT = r'E:\dev\hand-of-armok\screenshots\df-maps'
os.makedirs(OUT, exist_ok=True)
W = {  # name: slot
    'tamriel': 13, 'skyrim': 14, 'morrowind': 15, 'cyrodiil': 4, 'hammerfell': 5,
    'high-rock': 6, 'black-marsh': 7, 'elsweyr': 8, 'valenwood': 10, 'summerset': 11,
}
try:
    font = ImageFont.truetype('arial.ttf', 40)
except Exception:
    font = ImageFont.load_default()
imgs = {}
for n, s in W.items():
    im = Image.open(f'{DF}\\region{s}-00250-01-01-detailed.bmp').convert('RGB')
    im.resize((2056, 2056), Image.LANCZOS).save(f'{OUT}\\{n}.png')
    imgs[n] = im.resize((1028, 1028), Image.LANCZOS)
    print(n, im.size)

def sheet(name, names, cols):
    rows = (len(names) + cols - 1) // cols
    pad, lab = 12, 56
    cw, ch = 1028, 1028 + lab
    sh = Image.new('RGB', (cols * cw + (cols + 1) * pad, rows * ch + (rows + 1) * pad), (20, 20, 20))
    d = ImageDraw.Draw(sh)
    for i, n in enumerate(names):
        x = pad + (i % cols) * (cw + pad)
        y = pad + (i // cols) * (ch + pad)
        sh.paste(imgs[n], (x, y))
        d.text((x + 8, y + 1028 + 6), n.replace('-', ' ').title(), fill=(235, 235, 235), font=font)
    sh.save(f'{OUT}\\{name}.png')

sheet('sheet-tamriel', ['tamriel'], 1)
sheet('sheet-A-skyrim-morrowind-cyrodiil-hammerfell', ['skyrim', 'morrowind', 'cyrodiil', 'hammerfell'], 2)
sheet('sheet-B-black-marsh-elsweyr-valenwood-summerset', ['black-marsh', 'elsweyr', 'valenwood', 'summerset'], 2)
sheet('sheet-C-cyrodiil-hammerfell-high-rock', ['cyrodiil', 'hammerfell', 'high-rock'], 3)
