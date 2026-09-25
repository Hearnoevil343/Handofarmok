"""Turn the A Song of Ice and Fire GIS shapefiles into 257x257 layers for the preset builder.

    python westeros.py <shapefile dir> <out.json>    (then gzip -9 it to westeros.json.gz)

Source: the fan GIS shapefiles of A Song of Ice and Fire by cadaei (after Tear of the
Cartographers' Guild, and theMountainGoat), released via the Atlas of Thrones project
(github.com/triestpa/Atlas-Of-Thrones,
https://cdn.patricktriest.com/shapefiles/game_of_thrones_shapes.zip). Licensed
CC BY-NC-SA 3.0 (https://creativecommons.org/licenses/by-nc-sa/3.0/), non-commercial use only;
this data and anything built from it (westeros.json.gz, the recipe, the preset output) stays
under that license. The world is (c) George R. R. Martin. See WESTEROS-CREDITS.md.

There is no elevation model of Westeros, so the height here is built from the measured
outlines: land rises gently away from the coast, the mountain outlines stand up by their
size class with ridged noise, low ground sinks toward the mapped rivers, and the Wall is a
ridge along its mapped line. Everything else (coast, lakes, forests, the Neck's swamp,
rivers) is the map's own geometry.
"""
import json, math, random, struct, sys

SIZE = 257; SS = 3; G = SIZE * SS           # supersampled raster for coverage
# plan covers Westeros and its islands (Iron Islands, Skagos, Bear Island, Tarth, Dragonstone,
# Stepstones) and the Lands of Always Winter, with a sea margin; the Essos coast is dropped.
# Westeros' own coastline is lon 0.9..26.3, lat -11.2..49.1; the Stepstones reach lon 29.3.
LON0, LAT0, LON_SPAN, LAT_SPAN = -2.0, 49.6, 33.0, 62.1
SEA = 16
DIR = sys.argv[1]
# the North's broad highland outline (lon 6..18, lat 22..35, roughly the Wolfswood/Deepwood/
# Winterfell area): thin its interior below the mountain threshold so hills, forest and
# grassland/tundra survive there for civs to spawn in, while real ridges still stand.
NORTH_MIXED = (6.0, 18.0, 22.0, 35.0)

def to_grid(x, y):  # lon/lat -> supersampled grid
    return (x - LON0) / LON_SPAN * G, (LAT0 - y) / LAT_SPAN * G

def tile_lonlat(tx, ty):  # tile index -> lon/lat, for geographic checks at tile resolution
    return LON0 + tx / SIZE * LON_SPAN, LAT0 - ty / SIZE * LAT_SPAN

def read_dbf(name):
    data = open(f'{DIR}/{name}.dbf', 'rb').read()
    count, header, length = struct.unpack('<IHH', data[4:12])
    fields, o = [], 32
    while data[o] != 0x0D:
        fields.append((data[o:o + 11].split(b'\0')[0].decode(), data[o + 11:o + 12].decode(), data[o + 16]))
        o += 32
    rows = []
    for r in range(count):
        o = header + r * length + 1; row = {}
        for fname, kind, size in fields:
            raw = data[o:o + size].decode('latin-1').strip(); o += size
            row[fname] = float(raw) if kind in 'NF' and raw else raw
        rows.append(row)
    return rows

def read_shp(name):
    """(kind, parts) per record; the declared file length is wrong in this release, so read to the end."""
    data = open(f'{DIR}/{name}.shp', 'rb').read(); o = 100; shapes = []
    while o + 8 <= len(data):
        _, words = struct.unpack('>ii', data[o:o + 8]); body = data[o + 8:o + 8 + words * 2]; o += 8 + words * 2
        kind = struct.unpack('<i', body[:4])[0]
        if kind == 1: shapes.append((1, [[struct.unpack('<2d', body[4:20])]])); continue
        if kind == 0: shapes.append((0, [])); continue
        nparts, npts = struct.unpack('<ii', body[36:44])
        starts = list(struct.unpack(f'<{nparts}i', body[44:44 + 4 * nparts])) + [npts]
        pts = [struct.unpack('<2d', body[44 + 4 * nparts + 16 * k:60 + 4 * nparts + 16 * k]) for k in range(npts)]
        shapes.append((kind, [pts[starts[k]:starts[k + 1]] for k in range(nparts)]))
    return shapes

def features(name):
    return list(zip(read_shp(name), read_dbf(name)))

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

def raster(items, value=1, mask=None):
    mask = mask if mask is not None else bytearray(G * G)
    for (kind, parts), _ in items:
        fill(mask, [[to_grid(*pt) for pt in r] for r in parts], value)
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

def distance(seed):
    """Chamfer distance in tiles from every tile to the nearest seed tile."""
    d = [0.0 if s else 1e9 for s in seed]
    for forward in (True, False):
        ys = range(SIZE) if forward else range(SIZE - 1, -1, -1)
        steps = [(-1, 0, 1), (0, -1, 1), (-1, -1, 1.414), (1, -1, 1.414)]
        if not forward: steps = [(-dx, -dy, w) for dx, dy, w in steps]
        for ty in ys:
            for tx in (range(SIZE) if forward else range(SIZE - 1, -1, -1)):
                i = ty * SIZE + tx; best = d[i]
                for dx, dy, w in steps:
                    nx, ny = tx + dx, ty + dy
                    if 0 <= nx < SIZE and 0 <= ny < SIZE and d[ny * SIZE + nx] + w < best: best = d[ny * SIZE + nx] + w
                d[i] = best
    return d

def value_noise(rng, cells, ridged=False):
    """Fractal value noise over the tile grid, 0-1."""
    out = [0.0] * (SIZE * SIZE); amp_total = 0; amp = 1.0; n = cells
    for _ in range(4):
        lattice = [[rng.random() for _ in range(n + 2)] for _ in range(n + 2)]
        for ty in range(SIZE):
            fy = ty / SIZE * n; y0 = int(fy); sy = fy - y0; sy = sy * sy * (3 - 2 * sy)
            for tx in range(SIZE):
                fx = tx / SIZE * n; x0 = int(fx); sx = fx - x0; sx = sx * sx * (3 - 2 * sx)
                a = lattice[y0][x0] + (lattice[y0][x0 + 1] - lattice[y0][x0]) * sx
                b = lattice[y0 + 1][x0] + (lattice[y0 + 1][x0 + 1] - lattice[y0 + 1][x0]) * sx
                v = a + (b - a) * sy
                if ridged: v = 1 - abs(v * 2 - 1)
                out[ty * SIZE + tx] += v * amp
        amp_total += amp; amp *= 0.5; n *= 2
    return [v / amp_total for v in out]

def lines(items):
    for (kind, parts), row in items:
        for p in parts: yield p, row

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

def frayed(a, b, rng, depth=6, rough=0.18):
    """A ragged line from a to b by midpoint displacement, for coast the source map never drew."""
    if depth == 0: return [a]
    (ax, ay), (bx, by) = a, b
    length = math.hypot(bx - ax, by - ay); s = (rng.random() - 0.5) * 2 * rough * length
    m = ((ax + bx) / 2 - (by - ay) / length * s, (ay + by) / 2 + (bx - ax) / length * s)
    return frayed(a, m, rng, depth - 1, rough) + frayed(m, b, rng, depth - 1, rough)

def unframe(ring, rng):
    """The source map stops at lon 0.9 and lat 49.1, cutting the Lands of Always Winter square; round that corner off."""
    out = []; i = 0
    while i < len(ring):
        x, y = ring[i]
        if abs(x - 0.9) < 0.1 and abs(y - 43.14) < 0.1 and i + 3 < len(ring):
            out += frayed((x, y), (2.8, 47.2), rng) + frayed((2.8, 47.2), (8.5, 48.2), rng) + frayed((8.5, 48.2), (14.0, 47.8), rng) + frayed((14.0, 47.8), (18.3, 48.6), rng)
            i += 3
        else:
            out.append(ring[i]); i += 1
    return out

continents = [f for f in features('Continents') if f[1]['name'] == 'Westeros']
continents = [((kind, [unframe(r, random.Random(49)) for r in parts]), row) for (kind, parts), row in continents]
# islands with no continent tag (the Stepstones, Dragonstone, etc.) are Westeros' own; Essos is dropped
islands = [f for f in features('Islands') if f[1]['continent'] in ('Westeros', '') and f[1]['name'] != 'Summer Islands']
landscape = features('Landscape')
land = coverage(raster(continents + islands))
lakes = coverage(raster([f for f in features('Lakes')]))
forest = coverage(raster([f for f in landscape if f[1]['type'] == 'forest']))
wetland = coverage(raster([f for f in landscape if f[1]['type'] == 'swamp']))
mountains = [f for f in landscape if f[1]['type'] == 'mountain']
# low ranges (the Lonely Hills, the small Dornish ranges) count as hills; the big ones as mountains
hills = coverage(raster([f for f in mountains if f[1]['size'] <= 2]))
volcanic = coverage(raster([f for f in islands if f[1]['name'] == 'Dragonstone']))
sea = [255 - v for v in land]

rivers = {'River': [], 'Stream': []}
river_tiles = [0] * (SIZE * SIZE)
for pts, row in lines(features('Rivers')):
    p = tile_path(pts)
    if len(p) < 2: continue
    # named rivers and long unnamed ones are rivers; the rest are streams
    rivers['River' if row['name'] or len(p) >= 12 else 'Stream'].append(p)
    for i in p: river_tiles[i] = 1

rng = random.Random(298)  # the year A Game of Thrones opens
broad = value_noise(rng, 6); fine = value_noise(rng, 24); crest = value_noise(rng, 12, ridged=True)
is_land = [land[i] >= 128 for i in range(SIZE * SIZE)]
coast = distance([not l for l in is_land])
near_river = distance(river_tiles)

height = [0.0] * (SIZE * SIZE)
for i in range(SIZE * SIZE):
    if not is_land[i]:
        height[i] = 4 + 8 * broad[i]
        continue
    # lowland: rises inland over some 10 tiles, rolls with broad noise, sinks toward mapped rivers
    h = SEA + 6 + 26 * (1 - math.exp(-coast[i] / 10)) + 22 * (broad[i] - 0.5) + 8 * (fine[i] - 0.5)
    h -= 12 * math.exp(-near_river[i] / 3)
    height[i] = max(SEA + 2, h)

# soften the chamfer distance's straight facets
for _ in range(3):
    soft = height[:]
    for ty in range(SIZE):
        for tx in range(SIZE):
            i = ty * SIZE + tx
            if not is_land[i]: continue
            s = n = 0
            for ny in range(max(0, ty - 1), min(SIZE, ty + 2)):
                for nx in range(max(0, tx - 1), min(SIZE, tx + 2)):
                    if is_land[ny * SIZE + nx]: s += height[ny * SIZE + nx]; n += 1
            soft[i] = max(SEA + 2, s / n)
    height = soft

# mountains stand up from their outlines, higher toward their middles, crests from ridged noise
STRENGTH = {1: 120, 2: 110, 3: 150, 4: 200, 5: 200}
for f in mountains:
    mask = coverage(raster([f]))
    inside = distance([m < 128 for m in mask])
    lift = STRENGTH[int(f[1]['size'])]
    for i in range(SIZE * SIZE):
        if mask[i] < 40 or not is_land[i]: continue
        core = min(1.0, inside[i] / 4) ** 0.7 * (mask[i] / 255) ** 0.5
        ridge = 0.5 + 0.5 * crest[i]
        lon, lat = tile_lonlat(i % SIZE, i // SIZE)
        if NORTH_MIXED[0] <= lon <= NORTH_MIXED[1] and NORTH_MIXED[2] <= lat <= NORTH_MIXED[3]:
            core *= 0.55       # thin the broad highland interior
            ridge = crest[i]   # let troughs between ridges drop to open, non-mountain ground
        height[i] = max(height[i], height[i] + lift * core * ridge * (0.8 + 0.4 * fine[i]))

# the Wall: a ridge of ice along its mapped line
for pts, _ in lines(features('Wall')):
    for i in tile_path(pts):
        if is_land[i]: height[i] = max(height[i], 150)

height = [round(min(255.0, h), 2) for h in height]
out = {'size': SIZE, 'seaLevel': SEA, 'layers': {'height': height, 'sea': sea, 'lake': lakes, 'forest': forest,
       'wetland': wetland, 'hills': hills, 'volcanic': volcanic}, 'rivers': rivers}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print('wrote', sys.argv[2], 'rivers', {k: (len(v), sum(map(len, v))) for k, v in rivers.items()})
