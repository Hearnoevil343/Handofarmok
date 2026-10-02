"""Turn the Ultima VI surface map into 257x257 layers for the preset builder.

    python britannia.py <classes.npy> <out.json>    (then gzip -9 it to britannia.json.gz)

Source: Otmar Lendl's tile-id map of the Ultima VI surface
(https://lendl.priv.at/~lendl/ultima/ultima6/brit.raw.gif, 1024x1024, one pixel per game tile,
pixel value = tile id), with tiles identified against Andrew Jenner's tile sheet
(http://www.reenigne.org/computer/u6maps/u6tiles.png). classes.npy is that map sorted into
terrain classes (row = y): 0 deep water, 1 shallow water and rivers, 2 grass, 3 forest, 4 swamp,
5 mountain, 6 hills, 8 the red ground around the Shrine of Sacrifice (the desert; the recipe
paints it), 9 white peaks (mountain), 11 the black frame (ocean). Neither source states a
licence; both are credited in BRITANNIA-CREDITS.md and the preset stays non-commercial. The world
of Britannia is copyright Origin Systems / Electronic Arts.

The game has no elevation, so the height here is built from the map: land rises gently away
from the coast and the mountain tiles stand up with ridged noise. Coast, lakes, forests, swamps
and rivers are the map's own; rivers are the water lines too narrow to survive the 4:1 shrink.
"""
import json, math, random, sys
import numpy as np

SIZE = 257; SRC = 1024; SEA = 16
cls = np.load(sys.argv[1])
water = np.isin(cls, (0, 1, 11))

def coverage(mask):
    """Share of each world tile (about 4x4 map tiles) covered by mask, 0-255."""
    edges = np.linspace(0, SRC, SIZE + 1).round().astype(int)
    m = mask.astype(np.float64)
    rows = np.add.reduceat(m, edges[:-1], axis=0)
    cells = np.add.reduceat(rows, edges[:-1], axis=1)
    area = np.outer(np.diff(edges), np.diff(edges))
    return np.round(cells / area * 255).astype(int)

def shift_all(mask, r, op):
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r: continue
            s = np.roll(np.roll(mask, dy, 0), dx, 1)
            out = op(out, s)
    return out

def components(mask):
    """4-connected components of a 2D bool array, as lists of flat indices."""
    h, w = mask.shape; seen = np.zeros_like(mask); out = []
    for start in zip(*np.nonzero(mask)):
        if seen[start]: continue
        stack = [start]; seen[start] = True; comp = []
        while stack:
            y, x = stack.pop(); comp.append(int(y * w + x))
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True; stack.append((ny, nx))
        out.append(comp)
    return out

def distance(seed):
    """Chamfer distance in tiles from every tile to the nearest seed tile."""
    d = np.where(seed, 0.0, 1e9)
    for _ in range(2):
        for ty in range(SIZE):
            for tx in range(SIZE):
                best = d[ty, tx]
                for dx, dy, w in ((-1, 0, 1), (0, -1, 1), (-1, -1, 1.414), (1, -1, 1.414)):
                    nx, ny = tx + dx, ty + dy
                    if 0 <= nx < SIZE and 0 <= ny < SIZE and d[ny, nx] + w < best: best = d[ny, nx] + w
                d[ty, tx] = best
        d = d[::-1, ::-1]
    return d

def value_noise(rng, cells, ridged=False):
    """Fractal value noise over the tile grid, 0-1."""
    out = np.zeros((SIZE, SIZE)); total = 0; amp = 1.0; n = cells
    t = np.arange(SIZE) / SIZE
    for _ in range(4):
        lat = np.array([[rng.random() for _ in range(n + 2)] for _ in range(n + 2)])
        f = t * n; i0 = f.astype(int); s = f - i0; s = s * s * (3 - 2 * s)
        a = lat[np.ix_(i0, i0)] + (lat[np.ix_(i0, i0 + 1)] - lat[np.ix_(i0, i0)]) * s[None, :]
        b = lat[np.ix_(i0 + 1, i0)] + (lat[np.ix_(i0 + 1, i0 + 1)] - lat[np.ix_(i0 + 1, i0)]) * s[None, :]
        v = a + (b - a) * s[:, None]
        if ridged: v = 1 - abs(v * 2 - 1)
        out += v * amp; total += amp; amp *= 0.5; n *= 2
    return out / total

# water that survives an opening of radius 3 is broad (sea, lakes); the rest are rivers and creeks
broad_water = shift_all(shift_all(water, 3, np.logical_and), 3, np.logical_or) & water
narrow = water & ~broad_water
# Castle British's moat is drawn as water; it is not a river
narrow[340:375, 290:330] = False

water_cov = coverage(broad_water)
is_water = water_cov >= 128
# broad water joined to the map edge is sea, the rest lakes
sea_mask = np.zeros_like(is_water)
for comp in components(is_water):
    ys, xs = np.divmod(np.array(comp), SIZE)
    if ys.min() == 0 or xs.min() == 0 or ys.max() == SIZE - 1 or xs.max() == SIZE - 1:
        sea_mask.flat[comp] = True
sea = np.where(sea_mask, water_cov, 0)
lake = np.where(is_water & ~sea_mask, water_cov, 0)
is_land = ~is_water

forest = coverage(cls == 3)
wetland = coverage(cls == 4)
hills = coverage(cls == 6)
mountain = coverage(np.isin(cls, (5, 9)))
volcanic = np.zeros((SIZE, SIZE), int)
# the Isle of the Avatar is an active volcano in the lore; the map draws it as plain mountains
for ty in range(SIZE):
    for tx in range(SIZE):
        x, y = tx * SRC / SIZE, ty * SRC / SIZE
        if 870 <= x <= 955 and 840 <= y <= 945 and is_land[ty, tx] and mountain[ty, tx] > 40: volcanic[ty, tx] = 255

river_cov = coverage(narrow)
river_tiles = (river_cov >= 20) & is_land
rivers = {'River': [], 'Stream': []}
for comp in components(river_tiles):
    if len(comp) < 3: continue
    rivers['River' if len(comp) >= 12 else 'Stream'].append(comp)

rng = random.Random(1990)  # the year Ultima VI shipped
broad = value_noise(rng, 6); fine = value_noise(rng, 24); crest = value_noise(rng, 12, ridged=True)
coast = distance(~is_land)
near_river = distance(river_tiles)

h = SEA + 6 + 22 * (1 - np.exp(-coast / 8)) + 18 * (broad - 0.5) + 8 * (fine - 0.5) - 10 * np.exp(-near_river / 3)
height = np.where(is_land, np.maximum(SEA + 2, h), 4 + 8 * broad)
for _ in range(3):   # soften the chamfer distance's straight facets
    pad = np.pad(np.where(is_land, height, 0), 1); cnt = np.pad(is_land.astype(float), 1)
    s = sum(pad[1 + dy:SIZE + 1 + dy, 1 + dx:SIZE + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    c = sum(cnt[1 + dy:SIZE + 1 + dy, 1 + dx:SIZE + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    height = np.where(is_land, np.maximum(SEA + 2, s / np.maximum(c, 1)), height)

# U6 draws its ranges as walls one to three tiles thick, so a quarter-covered world tile is ridge
core = np.clip(mountain / 255 * 2.5, 0, 1) ** 0.7
lift = 170 * core * (0.55 + 0.45 * crest) * (0.8 + 0.4 * fine)
height = np.where(is_land, height + lift, height)

out = {'size': SIZE, 'seaLevel': SEA, 'layers': {
    'height': [round(min(255.0, float(v)), 2) for v in height.flat],
    'sea': [int(v) for v in sea.flat], 'lake': [int(v) for v in lake.flat], 'forest': [int(v) for v in forest.flat],
    'wetland': [int(v) for v in wetland.flat], 'hills': [int(v) for v in hills.flat], 'volcanic': [int(v) for v in volcanic.flat]},
    'rivers': rivers}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print('wrote', sys.argv[2], 'land', int(is_land.sum()), 'lake tiles', int((lake > 0).sum()),
      'rivers', {k: (len(v), sum(map(len, v))) for k, v in rivers.items()}, 'volcanic', int((volcanic > 0).sum()))
