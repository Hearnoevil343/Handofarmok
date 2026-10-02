"""Turn the classic World of Warcraft world terrain map into 257x257 layers for the preset builder.

    python azeroth.py <azeroth.png> <out.json> [preview.png]   (then gzip -9 it to azeroth.json.gz)

Source: teebling's hand-stitched high resolution terrain map of WoW Classic (1.12 client minimap
images), "wow_classic_high_resolution_world_terrain_map_azeroth.png", 13000 x 12000 px, from
https://www.warcrafttavern.com/community/art-resources/high-resolution-terrain-maps-of-azeroth/
(also https://barrens.chat). Free for non-commercial use with credit and a link to barrens.chat;
see AZEROTH-CREDITS.md. The world of Azeroth is copyright Blizzard Entertainment.

The minimap has no elevation, so the height is built from the picture: land rises away from the
coast, snowfields and the flat filler the game paints over its impassable mountains (between zones)
stand up as ridges. Sea is the smooth or blue ground joined to the map edge; lakes are blue patches
inside the land. Needs numpy, scipy and Pillow.
"""
import json, random, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

Image.MAX_IMAGE_PIXELS = None
SIZE = 257; SEA = 16
# square crop of the 13000 x 12000 picture holding both continents, Teldrassil and the south isles
CROP = (750, 150, 12550, 11950); G = 2950          # worked at 4:1, about 11.5 px per world tile

src = Image.open(sys.argv[1]).convert('RGB').crop(CROP).resize((G, G), Image.BOX)
a = np.asarray(src).astype(np.float32)
lum = a.mean(2)
m = nd.uniform_filter(lum, 7)
texture = nd.uniform_filter(np.sqrt(np.maximum(nd.uniform_filter(lum * lum, 7) - m * m, 0)), 5)
f = np.stack([nd.uniform_filter(a[..., i], 5) for i in range(3)], -1)
r, g, b = f[..., 0], f[..., 1], f[..., 2]; flum = f.mean(2)

# sea: smooth or blue ground connected to the map edge (the minimap's shallows are blue-tinted)
blue = ((b - r) > 8) & (flum < 170)
wet = blue | (texture < 3.0)
lab, _ = nd.label(wet)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
sea = nd.binary_closing(nd.binary_opening(np.isin(lab, list(edge)), iterations=2), iterations=2)
land = ~sea

snow = (flum > 165) & (np.abs(r - b) < 25) & land
snow = nd.binary_opening(snow, iterations=2)
near_snow = nd.binary_dilation(snow, iterations=12)
# lakes: clearly blue, not snow shading, at least two world tiles
lake_px = ((b - r) > 20) & (flum < 150) & land & ~near_snow
lab2, n2 = nd.label(nd.binary_opening(lake_px, iterations=2))
sz = nd.sum(np.ones_like(lab2), lab2, range(1, n2 + 1))
lake_px = np.isin(lab2, np.nonzero(sz >= 260)[0] + 1)
# flat filler: the game paints its impassable mountains between zones as untextured ground
filler = nd.binary_opening((nd.uniform_filter(texture, 5) < 2.5) & land & ~lake_px, iterations=3)
# forest: dark textured green
forest_px = (g > r + 2) & (g > b + 8) & (flum > 30) & (flum < 105) & (texture > 6) & land

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
forest = coverage(forest_px)
# the picture shows few of the mountain walls WoW raises between zones; these are drawn by hand in
# pixels of the cropped map shown 1200 px square (as the recipe's `m`), with half-widths in those pixels
WALLS = [
    # Kalimdor
    ('Stonetalon Peak', [(120, 470), (170, 520), (215, 560)], 14),
    ('Hyjal rim', [(240, 330), (290, 300), (360, 305), (385, 345), (350, 395), (280, 400), (245, 370), (240, 330)], 8),
    ('Winterspring east', [(455, 190), (465, 250), (450, 300)], 10),
    ('Thousand Needles walls', [(215, 800), (290, 790), (350, 830)], 8),
    ("Un'Goro rim", [(205, 905), (250, 885), (295, 905), (300, 950), (250, 990), (205, 970), (205, 905)], 6),
    ('Feralas-Desolace wall', [(40, 715), (100, 712), (160, 715)], 7),
    # Eastern Kingdoms
    ('Alterac Mountains', [(840, 380), (880, 370), (910, 395)], 12),
    ('Arathi-Hinterlands wall', [(900, 415), (960, 410), (1040, 410)], 6),
    ('Thandol wall', [(820, 610), (900, 612), (990, 608)], 8),
    ('Khaz Modan east', [(978, 625), (980, 700), (975, 760)], 8),
    ('Blackrock and the Searing Gorge', [(865, 770), (900, 790), (950, 780), (1000, 790)], 10),
    ('Badlands', [(960, 720), (1020, 735), (1060, 750)], 9),
    ('Redridge Mountains', [(935, 840), (985, 855), (1030, 850)], 9),
    ('Deadwind Pass', [(955, 895), (962, 950), (958, 1000)], 9),
]

def wall_cover():
    """Coverage 0-255 of the hand-drawn walls, with a soft edge."""
    ys, xs = np.mgrid[0:SIZE, 0:SIZE]; px = (xs + 0.5) * 1200 / SIZE; py = (ys + 0.5) * 1200 / SIZE
    out = np.zeros((SIZE, SIZE))
    for _, pts, w in WALLS:
        d = np.full((SIZE, SIZE), 1e9)
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            vx, vy = x1 - x0, y1 - y0
            t = np.clip(((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy), 0, 1)
            d = np.minimum(d, np.hypot(px - x0 - t * vx, py - y0 - t * vy))
        out = np.maximum(out, np.clip(1.5 - d / w, 0, 1))
    return np.round(out * 255)

# snowfields are high but not all peaks: half weight, so Winterspring and Dun Morogh keep valleys
mountain = np.maximum(np.maximum(coverage(filler), coverage(snow) // 2), wall_cover())

def value_noise(rng, cells, ridged=False):
    """Fractal value noise over the tile grid, 0-1."""
    out = np.zeros((SIZE, SIZE)); total = 0; amp = 1.0; n = cells
    t = np.arange(SIZE) / SIZE
    for _ in range(4):
        lat = np.array([[rng.random() for _ in range(n + 2)] for _ in range(n + 2)])
        fi = t * n; i0 = fi.astype(int); s = fi - i0; s = s * s * (3 - 2 * s)
        p = lat[np.ix_(i0, i0)] + (lat[np.ix_(i0, i0 + 1)] - lat[np.ix_(i0, i0)]) * s[None, :]
        q = lat[np.ix_(i0 + 1, i0)] + (lat[np.ix_(i0 + 1, i0 + 1)] - lat[np.ix_(i0 + 1, i0)]) * s[None, :]
        v = p + (q - p) * s[:, None]
        if ridged: v = 1 - abs(v * 2 - 1)
        out += v * amp; total += amp; amp *= 0.5; n *= 2
    return out / total

rng = random.Random(2004)  # the year World of Warcraft shipped
broad = value_noise(rng, 6); fine = value_noise(rng, 24); crest = value_noise(rng, 12, ridged=True)
coast = nd.distance_transform_edt(is_land)
h = SEA + 6 + 26 * (1 - np.exp(-coast / 8)) + 16 * (broad - 0.5) + 8 * (fine - 0.5)
height = np.where(is_land, np.maximum(SEA + 2, h), 4 + 8 * broad)
height = np.where(is_land, np.maximum(SEA + 2, nd.uniform_filter(height, 3)), height)
core = np.clip(mountain / 255 * 2.0, 0, 1) ** 0.7
height = np.where(is_land, height + 160 * core * (0.55 + 0.45 * crest) * (0.8 + 0.4 * fine), height)

zero = [0] * (SIZE * SIZE)
out = {'size': SIZE, 'seaLevel': SEA, 'layers': {
    'height': [round(min(255.0, float(v)), 2) for v in height.flat],
    'sea': [int(v) for v in sea_l.flat], 'lake': [int(v) for v in lake_l.flat],
    'forest': [int(v) for v in np.where(is_land, forest, 0).flat],
    'wetland': zero, 'hills': zero, 'volcanic': zero}}
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))
print('wrote', sys.argv[2], 'land', int(is_land.sum()), 'lake tiles', int(is_lake.sum()),
      'mountain tiles', int((mountain > 64).sum() ), 'forest tiles', int((forest > 64).sum()))

if len(sys.argv) > 3:
    o = a * 0.6
    o[sea] = [0, 0, 90]; o[lake_px] = [255, 0, 255]; o[filler] = [255, 80, 0]; o[snow] = [255, 255, 255]
    o[forest_px] = o[forest_px] * 0.3 + np.array([0, 255, 0]) * 0.7
    Image.fromarray(o.astype(np.uint8)).resize((1200, 1200)).save(sys.argv[3])
