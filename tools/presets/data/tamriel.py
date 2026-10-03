"""Turn UESP's painted map of Tamriel into 257x257 layers for the preset builder.

    python tamriel.py <map> <tamriel.png> <out.json> [preview.png] [--dump]
                                                     (then gzip -9 it to <map>.json.gz)

<map> is tamriel (the whole continent) or skyrim (a square window of the same view). A window is a
plain crop of the same picture: the neighbouring provinces run off its edges and no sea is invented
at the cut, so the two maps show the same ground where they overlap.

Source: the Elder Scrolls Online world map on UESP, stitched from its tiles,
https://maps.uesp.net/esomap/tamriel/zoom10/tamriel-<x>-<y>.jpg, 8 x 8 tiles of 256 px = 2048 px
square (zoom 11 and 12 are the same picture upscaled, so zoom 10 is the real resolution). UESP text
is CC BY-SA 2.5; the map art is ZeniMax's and the world of Tamriel is theirs. Credit both,
non-commercial; see TAMRIEL-CREDITS.md.

It is a parchment map: land is a warm tan fill inside a dark coast line, sea a grey-green wash, and
the paper outside the wash is cream. So land is read by colour (warm and not pale) and then kept
only where it has that dark coast line around it, which throws away the stains on the open paper.
Nothing else is painted - no forest, no relief - so height is built from the picture the way
azeroth.py does it (land rises away from its coast) and every mountain range is drawn by hand below,
in the same view pixels the recipe uses. Climate is the recipe's work. Needs numpy, scipy and Pillow.

Every length here is either in view pixels (the ranges, the pale windows) or scaled by `z`, how many
times smaller this map's window is than the whole view. A window is cut from fewer source pixels and
blown up to the same 2056 px working picture, and its 257 tiles cover less ground, so without that
factor the same numbers would mean different real distances on the two maps - a different blur
reading the coast, a finer mountain noise, a coast rise two and a half times too steep. With it,
every step measures the same ground, and the whole-continent map (z = 1) is untouched.
"""
import json, math, random, sys, zlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

import tamriel_data as TD

Image.MAX_IMAGE_PIXELS = None
SIZE = 257; SEA = 16
# square crop of the 2048 px picture holding Tamriel, Vvardenfell, Solstheim, Summerset and Thras,
# called "the view" below and shown 1200 px square (as the recipe's coordinates)
CROP = (75, 242, 1880, 2047); G = 2056              # 8 px per world tile
VIEW = 1200
# the land each map keeps, in view pixels; the map is the square around it
# (the same rectangles are in recipes/tamriel.ts)
MAPS = {'tamriel': (0, 0, 1200, 1200), 'skyrim': (306, 55, 786, 535), 'morrowind': (680, 40, 1200, 560), 'cyrodiil': (440, 215, 960, 735), 'hammerfell': (20, 260, 540, 780), 'high_rock': (0, 0, 480, 480), 'black_marsh': (700, 430, 1200, 930), 'elsweyr': (485, 500, 1005, 1020), 'valenwood': (230, 495, 750, 1015), 'summerset': (0, 535, 480, 1015)}
dump = '--dump' in sys.argv
if dump: sys.argv.remove('--dump')
check = '--check' in sys.argv
if check: sys.argv.remove('--check')
name = sys.argv.pop(1)
x0, y0, x1, y1 = MAPS[name]
side = max(x1 - x0, y1 - y0); sx = (x0 + x1 - side) / 2; sy = (y0 + y1 - side) / 2
z = VIEW / side                                     # 1 for the continent, more for a window


def gp(v):
    """A length written for the whole view, in this map's pixels or tiles."""
    return max(1, int(round(v * z)))


k = (CROP[2] - CROP[0]) / VIEW
box = tuple(round(v) for v in (CROP[0] + sx * k, CROP[1] + sy * k, CROP[0] + (sx + side) * k, CROP[1] + (sy + side) * k))
src = Image.open(sys.argv[1]).convert('RGB').crop(box).resize((G, G), Image.LANCZOS)
a = np.asarray(src).astype(np.float32).copy()
f = np.stack([nd.uniform_filter(a[..., i], gp(2)) for i in range(3)], -1)
r, g, b = f[..., 0], f[..., 1], f[..., 2]; flum = f.mean(2)

# land: the warm tan fill, kept only where a dark coast line runs around it, which is what the open
# paper's warm stains have not got.
dark = flum < 118


def filled(min_warmth, max_blue):
    """Fill at least this warm and this far from paper, opened and closed to whole blocks.

    The edge of the picture is not an edge of the land. A window is a crop and the fill runs on past
    it, but opening treats everything outside the array as paper and so eats a strip off all four
    sides - which left the mainland a few pixels short of the border, put its own coast test's ring
    on inland tan instead of the drawn coast line (0.346 against the 0.35 bar) and threw the whole of
    Skyrim away. So the mask is carried out past the border before the morphology and cut back after.
    """
    m = ((r - b) > min_warmth) & (b < max_blue)
    pad = gp(1) + gp(2) + 2
    m = nd.binary_closing(nd.binary_opening(np.pad(m, pad, mode='edge'), iterations=gp(1)), iterations=gp(2))
    return m[pad:-pad, pad:-pad]


warm = filled(70, 108)
lab, n = nd.label(warm)
land = np.zeros((G, G), bool)
for i in range(1, n + 1):
    piece = lab == i
    if piece.sum() < 16 * z * z: continue
    ring = nd.binary_dilation(piece, iterations=gp(3)) & ~piece
    if dark[ring].mean() > 0.35: land |= piece
# Solstheim is painted in a much paler fill than the rest, pale enough that reading it needs a test
# loose enough to take the open paper as well - so it is read inside its own window, in view pixels.
# A loose test over the whole map also bridges its strait and closes the eastern bays.
PALE = [('Solstheim', (788, 68, 892, 182))]
pale = filled(55, 135)
for _, (wx0, wy0, wx1, wy1) in PALE:
    gx0, gy0, gx1, gy1 = (round((v - o) / side * G) for v, o in ((wx0, sx), (wy0, sy), (wx1, sx), (wy1, sy)))
    if gx1 <= 0 or gy1 <= 0 or gx0 >= G or gy0 >= G: continue   # outside this map's window
    window = np.zeros((G, G), bool)
    window[max(gy0, 0):gy1, max(gx0, 0):gx1] = True
    land |= pale & window

# sea is the water joined to the map edge; water shut inside the land is a lake (Tamriel has few)
wlab, _ = nd.label(~land)
edge = set(np.unique(np.concatenate([wlab[0], wlab[-1], wlab[:, 0], wlab[:, -1]]))) - {0}
sea = np.isin(wlab, list(edge))
lake_px = ~land & ~sea


def coverage(mask):
    """Share of each world tile covered by mask, 0-255."""
    edges = np.linspace(0, G, SIZE + 1).round().astype(int)
    cells = np.add.reduceat(np.add.reduceat(mask.astype(np.float64), edges[:-1], axis=0), edges[:-1], axis=1)
    return np.round(cells / np.outer(np.diff(edges), np.diff(edges)) * 255).astype(int)


sea_cov = coverage(sea); lake_cov = coverage(lake_px)
is_lake = (lake_cov >= 128)
is_sea = (sea_cov >= 128) & ~is_lake
is_land = ~is_sea & ~is_lake
sea_l = np.where(is_sea, sea_cov, 0); lake_l = np.where(is_lake, lake_cov, 0)
# The map paints no relief, no forest and no rivers. Tamriel's geography is therefore written as
# vectors in tamriel_data.py, in the same view pixels the recipe uses, the way westeros.py reads
# them from its fan map. A window keeps whatever reaches into it; the rest falls outside.

def frayed(a, b, rng, depth=4, rough=0.12):
    """A ragged line from a to b by midpoint displacement - a drawn outline is never straight."""
    if depth == 0: return [a]
    (ax, ay), (bx, by) = a, b
    length = math.hypot(bx - ax, by - ay)
    if length < 1e-6: return [a]
    sgn = (rng.random() - 0.5) * 2 * rough * length
    m = ((ax + bx) / 2 - (by - ay) / length * sgn, (ay + by) / 2 + (bx - ax) / length * sgn)
    return frayed(a, m, rng, depth - 1, rough) + frayed(m, b, rng, depth - 1, rough)


def ragged(ring, seed, rough=0.12):
    """Every edge of a ring or line, broken up. Same seed per feature, so a window matches the map."""
    rng = random.Random(seed)
    out = []
    for a, b in zip(ring, ring[1:]):
        out += frayed(a, b, rng, 4, rough)
    out.append(ring[-1])
    return out


def to_grid(x, y):
    return ((x - sx) / side * G, (y - sy) / side * G)


def poly_cover(rings):
    """Coverage 0-255 of filled rings given in view pixels."""
    img = Image.new('L', (G, G), 0); d = ImageDraw.Draw(img)
    for pts in rings:
        if len(pts) < 3: continue
        ring = ragged(list(pts) + [pts[0]], hash(tuple(pts)) & 0xffff, 0.14)
        d.polygon([to_grid(*q) for q in ring], fill=255)
    return coverage(np.asarray(img) > 127)


def wall_cover(items):
    """Coverage 0-255 of line ranges, with a soft edge, from (name, pts, half_width) in view px."""
    ys, xs = np.mgrid[0:SIZE, 0:SIZE]; px = sx + (xs + 0.5) * side / SIZE; py = sy + (ys + 0.5) * side / SIZE
    out = np.zeros((SIZE, SIZE))
    for nm, pts0, w in items:
        pts = ragged(list(pts0), zlib.crc32(nm.encode()) & 0xffff, 0.10) if len(pts0) > 1 else pts0
        d = np.full((SIZE, SIZE), 1e9)
        wr = random.Random(zlib.crc32(nm.encode()) & 0xffff)
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            vx, vy = bx - ax, by - ay
            if vx == 0 and vy == 0: continue
            t = np.clip(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy), 0, 1)
            d = np.minimum(d, np.hypot(px - ax - t * vx, py - ay - t * vy))
        out = np.maximum(out, np.clip(1.5 - d / (w * (0.7 + 0.6 * wr.random())), 0, 1))
    return np.round(out * 255)


# half width 8 and over is a mountain range; below that it is foothills
mountain = wall_cover([r for r in TD.RANGES if r[2] >= 8])
hill_l = np.where(is_land, wall_cover([r for r in TD.RANGES if r[2] < 8]), 0).astype(int)
forest_l = np.where(is_land, poly_cover([q for _, q in TD.FORESTS]), 0).astype(int)
wet_l = np.where(is_land, poly_cover([q for _, q in TD.WETLANDS]), 0).astype(int)
volcanic_l = np.where(is_land, poly_cover([q for n, q, _ in TD.RANGES if n == 'Red Mountain'] + [q for _, q in TD.VOLCANIC]), 0).astype(int)

S = G / SIZE


def tile_path(pts):
    """A river's view-pixel line as 4-connected land tile indices inside this map's window."""
    path = []

    def add(tx, ty):
        if 0 <= tx < SIZE and 0 <= ty < SIZE and is_land[ty, tx]:
            i = ty * SIZE + tx
            if not path or path[-1] != i: path.append(i)

    prev = None
    for x, y in ragged(list(pts), hash(tuple(pts)) & 0xffff, 0.16):
        gx, gy = to_grid(x, y); tx, ty = int(gx // S), int(gy // S)
        if prev is None: add(tx, ty)
        else:
            px_, py_ = prev
            while (px_, py_) != (tx, ty):   # one axis at a time, so the path stays 4-connected
                if abs(tx - px_) >= abs(ty - py_): px_ += 1 if tx > px_ else -1
                else: py_ += 1 if ty > py_ else -1
                add(px_, py_)
        prev = (tx, ty)
    return path


rivers = {'River': [], 'Stream': []}
river_tiles = np.zeros((SIZE, SIZE), bool)
for _, pts, kind in TD.RIVERS:
    path = tile_path(pts)
    if len(path) < 2: continue          # the river does not reach into this window
    rivers[kind].append(path)
    for i in path: river_tiles[i // SIZE, i % SIZE] = True

def view_fraction(off):
    """Where this map's tile centres fall across the whole view, 0-1."""
    return (off + np.arange(SIZE) * side / SIZE) / VIEW


def value_noise(rng, cells, ridged=False):
    """Fractal value noise, sampled in view coordinates so every map reads the same field."""
    out = np.zeros((SIZE, SIZE)); total = 0; amp = 1.0; n = cells
    fx = view_fraction(sx); fy = view_fraction(sy)
    for _ in range(4):
        lat = np.array([[rng.random() for _ in range(n + 2)] for _ in range(n + 2)])
        ix = (fx * n).astype(int); u = fx * n - ix; u = u * u * (3 - 2 * u)
        iy = (fy * n).astype(int); v = fy * n - iy; v = v * v * (3 - 2 * v)
        p = lat[np.ix_(iy, ix)] + (lat[np.ix_(iy, ix + 1)] - lat[np.ix_(iy, ix)]) * u[None, :]
        q = lat[np.ix_(iy + 1, ix)] + (lat[np.ix_(iy + 1, ix + 1)] - lat[np.ix_(iy + 1, ix)]) * u[None, :]
        w = p + (q - p) * v[:, None]
        if ridged: w = 1 - abs(w * 2 - 1)
        out += w * amp; total += amp; amp *= 0.5; n *= 2
    return out / total


rng = random.Random(433)  # the year the Oblivion Crisis ends, 3E 433
broad = value_noise(rng, 6); fine = value_noise(rng, 24); crest = value_noise(rng, 12, ridged=True)
coast = nd.distance_transform_edt(is_land)
near_river = nd.distance_transform_edt(~river_tiles)
h = SEA + 6 + 26 * (1 - np.exp(-coast / (8 * z))) + 16 * (broad - 0.5) + 8 * (fine - 0.5)
h -= 12 * np.exp(-near_river / (3 * z))                 # valleys: the land sinks toward its rivers
height = np.where(is_land, np.maximum(SEA + 2, h), 4 + 8 * broad)
height = np.where(is_land, np.maximum(SEA + 2, nd.uniform_filter(height, gp(3))), height)
core = np.clip(mountain / 255 * 2.0, 0, 1) ** 0.7
height = np.where(is_land, height + 160 * core * (0.55 + 0.45 * crest) * (0.8 + 0.4 * fine), height)
hcore = np.clip(hill_l / 255 * 2.0, 0, 1) ** 0.7
height = np.where(is_land, height + 42 * hcore * (0.6 + 0.4 * crest), height)

out = {'size': SIZE, 'seaLevel': SEA, 'layers': {
    'height': [round(min(255.0, float(v)), 2) for v in height.flat],
    'sea': [int(v) for v in sea_l.flat], 'lake': [int(v) for v in lake_l.flat],
    'forest': [int(v) for v in forest_l.flat], 'wetland': [int(v) for v in wet_l.flat],
    'hills': [int(v) for v in hill_l.flat], 'volcanic': [int(v) for v in volcanic_l.flat]},
    'rivers': rivers}

if check:
    # every vector point that falls in the sea, so new geography can be checked without a picture
    bad = 0
    core = nd.binary_erosion(is_land, iterations=2)
    _, (iy, ix) = nd.distance_transform_edt(~(core if core.any() else is_land), return_indices=True)
    snaps = {}
    for tag, items in (('RIVER', TD.RIVERS), ('FOREST', TD.FORESTS), ('WETLAND', TD.WETLANDS), ('RANGE', TD.RANGES), ('VOLCANIC', TD.VOLCANIC)):
        for it in items:
            nm, pts = it[0], it[1]
            off = []
            for x, y in pts:
                tx, ty = int(to_grid(x, y)[0] // S), int(to_grid(x, y)[1] // S)
                if not (0 <= tx < SIZE and 0 <= ty < SIZE) or not is_land[max(0, ty - 1):ty + 2, max(0, tx - 1):tx + 2].any():
                    off.append((x, y))
                    ty2 = min(max(ty, 0), SIZE - 1); tx2 = min(max(tx, 0), SIZE - 1)
                    ny, nx = iy[ty2, tx2], ix[ty2, tx2]
                    snaps.setdefault(nm, []).append([[x, y], [round(sx + (nx + 0.5) * side / SIZE), round(sy + (ny + 0.5) * side / SIZE)]])
            if off:
                bad += len(off); print(f'{tag:7s} {nm:36s} {len(off)}/{len(pts)} in the sea: {off[:6]}')
    print('points in the sea:', bad)
    json.dump(snaps, open('snap.json', 'w'))
    ov = Image.fromarray((is_land * 120 + 40).astype('uint8')).resize((1200, 1200)).convert('RGB'); od = ImageDraw.Draw(ov)
    for tag, items, col in (('r', TD.RIVERS, (60, 120, 255)), ('f', TD.FORESTS, (0, 255, 0)), ('w', TD.WETLANDS, (255, 0, 255)), ('g', TD.RANGES, (255, 160, 0)), ('v', TD.VOLCANIC, (255, 0, 0))):
        for it in items:
            p = [(x, y) for x, y in it[1]]
            od.line(p + ([p[0]] if tag in 'fwv' else []), fill=col, width=1)
    ov.save('check.png')

json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print('wrote', sys.argv[2], name, 'view', (round(sx), round(sy), round(sx + side), round(sy + side)),
      'z', round(z, 3), 'land', int(is_land.sum()), 'lake tiles', int(is_lake.sum()),
      'mountain tiles', int((mountain > 64).sum()), 'hill tiles', int((hill_l > 64).sum()),
      'forest tiles', int((forest_l > 64).sum()), 'wetland tiles', int((wet_l > 64).sum()),
      'rivers', {k: (len(v), sum(map(len, v))) for k, v in rivers.items()})

if dump:
    # land, sea and ranges at 60 x 60 with view coordinates down the side and across the top, so a
    # place can be picked for a check without looking at a picture
    N = 60
    cols = [int((c + 0.5) * SIZE / N) for c in range(N)]
    for lead in range(3):
        row = ''
        for c in cols:
            label = f'{round(sx + (c + 0.5) * side / SIZE):4d}'
            row += label[lead + 1] if c % 6 == 0 else ' '
        print('     ' + row)
    for rw in range(N):
        ty = int((rw + 0.5) * SIZE / N)
        line = ''.join('^' if mountain[ty, tx] > 64 else '~' if is_lake[ty, tx] else '.' if is_sea[ty, tx] else '#' for tx in cols)
        print(f'{round(sy + (ty + 0.5) * side / SIZE):4d} {line}')

if len(sys.argv) > 3:
    o = a * 0.6
    o[sea] = [0, 0, 90]; o[lake_px] = [255, 0, 255]
    big = np.kron(mountain > 64, np.ones((G // SIZE, G // SIZE), bool))
    big = np.pad(big, ((0, G - big.shape[0]), (0, G - big.shape[1])))
    o[big & land] = [255, 80, 0]
    Image.fromarray(o.astype(np.uint8)).resize((1200, 1200)).save(sys.argv[3])
