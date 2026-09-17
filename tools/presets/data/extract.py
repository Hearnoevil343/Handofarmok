"""Turn ME-DEM (dem2000.raw) and vectors.gpkg into 257x257 layers for the preset builder."""
import sqlite3, struct, json, sys
from gpkg import wkb_geoms

SIZE = 257; SS = 3; G = SIZE * SS           # supersampled raster for coverage
X0, Y0, CROP = 160, 360, 1540               # crop of the 2000 px DEM
N = 2000
dem = open('dem2000.raw', 'rb').read()

def to_grid(x, y):  # map metres -> supersampled grid
    px = (x + 900) / 200.1 / 5; py = (2001100 - y) / 200.1 / 5
    return (px - X0) / CROP * G, (py - Y0) / CROP * G

def fill(mask, rings, value):
    """Even-odd scanline fill of a polygon (list of rings) into mask (bytearray G*G)."""
    ys = [p[1] for r in rings for p in r]
    y_lo = max(0, int(min(ys))); y_hi = min(G - 1, int(max(ys)) + 1)
    edges = []
    for r in rings:
        for i in range(len(r)):
            a = r[i]; b = r[(i + 1) % len(r)]
            if a[1] != b[1]: edges.append((a, b))
    for gy in range(y_lo, y_hi + 1):
        yc = gy + 0.5; xs = []
        for (ax, ay), (bx, by) in edges:
            if (ay > yc) != (by > yc): xs.append(ax + (yc - ay) * (bx - ax) / (by - ay))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            x_lo = max(0, int(xs[k] + 0.5)); x_hi = min(G - 1, int(xs[k + 1] - 0.5))
            row = gy * G
            for gx in range(x_lo, x_hi + 1): mask[row + gx] = value

def polys(geom):
    k, p = geom
    if k == 'poly': yield p
    elif k == 'multi':
        for part in p: yield from polys(part)

def raster(table, where='1=1', value=1, mask=None):
    mask = mask if mask is not None else bytearray(G * G)
    c = sqlite3.connect('vectors.gpkg')
    for (g,) in c.execute(f'select geom from "{table}" where {where}'):
        for rings in polys(wkb_geoms(g)):
            fill(mask, [[to_grid(*pt) for pt in r] for r in rings], value)
    return mask

def coverage(mask):
    out = []
    for ty in range(SIZE):
        for tx in range(SIZE):
            s = 0
            for dy in range(SS):
                row = (ty * SS + dy) * G + tx * SS
                s += sum(mask[row:row + SS])
            out.append(round(s * 255 / (SS * SS)))
    return out

layers = {}
forest = raster('forests', "type is null or type != 'Forest Clearing'")
raster('forests', "type = 'Forest Clearing'", 0, forest)
layers['forest'] = coverage(forest)
layers['wetland'] = coverage(raster('Wetlands'))
layers['hills'] = coverage(raster('Hills'))
layers['volcanic'] = coverage(raster('Vulcanism'))
layers['lake'] = coverage(raster('lakes'))

# sea: flood from the deepest water through everything at or below sea level
SEA = 16
sea = bytearray(N * N); stack = [i for i in range(N * N) if dem[i] <= 2]
for i in stack: sea[i] = 1
while stack:
    i = stack.pop(); x = i % N
    for j in (i - 1 if x > 0 else -1, i + 1 if x < N - 1 else -1, i - N, i + N):
        if 0 <= j < N * N and not sea[j] and dem[j] <= SEA:
            sea[j] = 1; stack.append(j)

height, seafrac = [], []
for ty in range(SIZE):
    for tx in range(SIZE):
        y_a = Y0 + ty * CROP / SIZE; x_a = X0 + tx * CROP / SIZE
        s = n = w = 0
        for py in range(int(y_a), int(y_a + CROP / SIZE)):
            for px in range(int(x_a), int(x_a + CROP / SIZE)):
                i = py * N + px; s += dem[i]; w += sea[i]; n += 1
        height.append(round(s / n, 2)); seafrac.append(round(w * 255 / n))
layers['height'] = height; layers['sea'] = seafrac
json.dump({'size': SIZE, 'seaLevel': SEA, 'layers': layers}, open(sys.argv[1], 'w'), separators=(',', ':'))
print('wrote', sys.argv[1])

# rivers: every river line as a 4-connected path of tiles, in drawing order
def lines(geom):
    k, p = geom
    if k == 'line': yield p
    elif k == 'multi':
        for part in p: yield from lines(part)

def tile_path(pts):
    path = []
    def add(tx, ty):
        if 0 <= tx < SIZE and 0 <= ty < SIZE:
            i = ty * SIZE + tx
            if not path or path[-1] != i: path.append(i)
    prev = None
    for x, y in pts:
        gx, gy = to_grid(x, y); tx, ty = int(gx // SS), int(gy // SS)
        if prev is None: add(tx, ty)
        else:
            px, py = prev
            while (px, py) != (tx, ty):   # step one axis at a time, so paths stay 4-connected
                if abs(tx - px) >= abs(ty - py): px += 1 if tx > px else -1
                else: py += 1 if ty > py else -1
                add(px, py)
        prev = (tx, ty)
    return path

c = sqlite3.connect('vectors.gpkg')
rivers = {'River': [], 'Stream': []}
for kind, (g,) in [(('River' if t == 'River, Unknown Length' else 'Stream'), (g,)) for t, g in c.execute("select type, geom from Rivers where type in ('River, Unknown Length', 'Stream')")]:
    for ln in lines(wkb_geoms(g)):
        p = tile_path(ln)
        if len(p) >= 2: rivers[kind].append(p)
data = json.load(open(sys.argv[1]))
data['rivers'] = rivers
json.dump(data, open(sys.argv[1], 'w'), separators=(',', ':'))
print('rivers', {k: (len(v), sum(map(len, v))) for k, v in rivers.items()})
