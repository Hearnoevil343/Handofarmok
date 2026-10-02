import os, glob, shutil, sys
import numpy as np
from PIL import Image

name = sys.argv[1] if len(sys.argv) > 1 else "hoa-britannia"
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 4
rows = int(sys.argv[3]) if len(sys.argv) > 3 else 5
raw = os.path.expandvars("%TEMP%\\" + name + "\\raw")
out = os.path.expandvars("%TEMP%\\" + name + "\\frames")
os.makedirs(out, exist_ok=True)
files = sorted(glob.glob(raw + r"\f*.png"))
small = [np.asarray(Image.open(f).convert("L").resize((256, 137)), dtype=np.float32) for f in files]
d = [0.0] + [float(np.abs(small[i] - small[i - 1]).mean()) for i in range(1, len(small))]
segs, cur = [], [0]
for i in range(1, len(files)):
    if d[i] > 10.0:
        segs.append(cur); cur = [i]
    else:
        cur.append(i)
segs.append(cur)
print("frames", len(files), "segments", len(segs), [len(s) for s in segs])
stable = [s for s in segs if len(s) >= 3]
print("stable", len(stable))
for k, s in enumerate(stable[-rows * cols:]):
    r, c = divmod(k, cols)
    shutil.copy(files[s[-1]], os.path.join(out, f"r{r}c{c}.png"))
