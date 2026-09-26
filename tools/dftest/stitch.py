"""Stitch DF map frames (rRcC.png) captured by grab.ps1 into one image.

Each frame is cropped to its UI-free area, and its position is measured against its
left (or upper) neighbour by phase correlation, because DF's pan steps are not uniform
near the map edge. The black void is trimmed at the end.
"""
import argparse
import os
import re

import numpy as np
from PIL import Image


def overlap_error(a, b, dx, dy):
    """Mean abs difference where b, placed at (dx, dy) relative to a, overlaps a."""
    h, w = a.shape
    x0, y0 = max(0, dx), max(0, dy)
    x1, y1 = min(w, dx + w), min(h, dy + h)
    # A 960 px row step leaves only 180 px of overlap in the 1140 px clean area.
    if x1 - x0 < 100 or y1 - y0 < 100:
        return None
    return np.abs(a[y0:y1, x0:x1] - b[y0 - dy:y1 - dy, x0 - dx:x1 - dx]).mean()


def measure(a, b, nominal):
    h, w = a.shape
    f = np.fft.fft2(a) * np.conj(np.fft.fft2(b))
    r = np.fft.ifft2(f / (np.abs(f) + 1e-9)).real
    peaks = np.argsort(r.ravel())[-5:]
    best = None
    for p in peaks:
        py, px = divmod(int(p), w)
        for dy in (py, py - h):
            for dx in (px, px - w):
                e = overlap_error(a, b, dx, dy)
                if e is None:
                    continue
                key = (round(e, 1), abs(dx - nominal[0]) + abs(dy - nominal[1]))
                if best is None or key < best[0]:
                    best = (key, dx, dy, e)
    return best[1], best[2], best[3]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dir")
    p.add_argument("out")
    p.add_argument("--step-x", type=int, default=1600, help="expected pan per column")
    p.add_argument("--step-y", type=int, default=960, help="expected pan per row")
    p.add_argument("--clean", default="60,50,2010,1190", help="x0,y0,x1,y1 of the UI-free area of a frame")
    p.add_argument("--void", type=int, default=12, help="max channel value counted as black void")
    a = p.parse_args()

    x0, y0, x1, y1 = map(int, a.clean.split(","))
    tiles, gray = {}, {}
    for name in os.listdir(a.dir):
        m = re.fullmatch(r"r(\d+)c(\d+)\.png", name)
        if m:
            t = np.asarray(Image.open(os.path.join(a.dir, name)).convert("RGB"))[y0:y1, x0:x1]
            tiles[(int(m[1]), int(m[2]))] = t
            gray[(int(m[1]), int(m[2]))] = t.astype(np.float32).mean(axis=2)

    pos = {}
    for r, c in sorted(tiles):
        if not pos:
            pos[(r, c)] = (0, 0)
            continue
        ref, nominal = ((r, c - 1), (a.step_x, 0)) if c > 0 else ((r - 1, c), (0, a.step_y))
        dx, dy, e = measure(gray[ref], gray[(r, c)], nominal)
        pos[(r, c)] = (pos[ref][0] + dx, pos[ref][1] + dy)
        print(f"r{r}c{c}: offset ({dx}, {dy}) from r{ref[0]}c{ref[1]}, error {e:.2f}")

    th, tw = next(iter(tiles.values())).shape[:2]
    mx = min(x for x, _ in pos.values())
    my = min(y for _, y in pos.values())
    w = max(x for x, _ in pos.values()) - mx + tw
    h = max(y for _, y in pos.values()) - my + th
    canvas = np.zeros((h, w, 3), np.uint8)
    for k, t in sorted(tiles.items()):
        x, y = pos[k][0] - mx, pos[k][1] - my
        canvas[y:y + th, x:x + tw] = t

    ys, xs = np.nonzero(canvas.max(axis=2) > a.void)
    crop = canvas[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(crop).save(a.out, optimize=True)
    print(f"saved {a.out} {crop.shape[1]}x{crop.shape[0]}")


if __name__ == "__main__":
    main()
