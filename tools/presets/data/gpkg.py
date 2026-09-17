import sqlite3, struct
def wkb_geoms(blob):
    # GeoPackage header
    flags = blob[3]; env = (flags >> 1) & 7
    off = 8 + {0:0,1:32,2:48,3:48,4:64}[env]
    return parse(blob, off)[0]
def parse(b, o):
    bo = '<' if b[o] == 1 else '>'; o += 1
    t = struct.unpack_from(bo+'I', b, o)[0]; o += 4
    dims = 2
    if t > 1000: dims = 3; t %= 1000
    if t & 0x80000000: dims = 3; t &= 0xff
    def pt(o):
        v = struct.unpack_from(bo+'d'*dims, b, o); return (v[0], v[1]), o + 8*dims
    if t == 1: p, o = pt(o); return ('pt', p), o
    if t == 2:
        n = struct.unpack_from(bo+'I', b, o)[0]; o += 4; ps = []
        for _ in range(n): p, o = pt(o); ps.append(p)
        return ('line', ps), o
    if t == 3:
        nr = struct.unpack_from(bo+'I', b, o)[0]; o += 4; rings = []
        for _ in range(nr):
            n = struct.unpack_from(bo+'I', b, o)[0]; o += 4; ps = []
            for _ in range(n): p, o = pt(o); ps.append(p)
            rings.append(ps)
        return ('poly', rings), o
    if t in (4,5,6):
        n = struct.unpack_from(bo+'I', b, o)[0]; o += 4; parts = []
        for _ in range(n): g, o = parse(b, o); parts.append(g)
        return ('multi', parts), o
    raise ValueError(t)
