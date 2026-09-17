import {
  BASE_TOKEN,
  FOREST_TOKEN,
  type Tileset,
  drawToken,
  loadTileset,
  mountainToken,
} from "@helpers/tileset";
import { useCallback, useEffect, useRef, useState } from "react";

import { LayerType } from "#types";
import { planWater, riverToken } from "@helpers/rivers";
import styles from "./GameView.module.scss";
import { realmStore } from "@world/realmStore";

const CELL = 16;

/**
 * Renders the current world with Dwarf Fortress's own world-map sprites, so you
 * can see what it will look like before generating it.
 *
 * The biome for each tile comes from the calibrated resolver, which matched
 * DF's own classification on 99.95% of a 65,536-combination test world, so this
 * is a faithful preview rather than an impression.
 */
export function GameView() {
  const [tileset, setTileset] = useState<Tileset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const pick = useCallback(async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    setError(null);
    try {
      setTileset(await loadTileset(files));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !tileset) return;
    const size = realmStore.size;
    canvas.width = size * CELL;
    canvas.height = size * CELL;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0d1b2a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const data = realmStore.layers;
    const el = data[LayerType.Elevation];
    const vl = data[LayerType.Volcanism];

    const variant = (x: number, y: number) =>
      (((x * 73856093) ^ (y * 19349663)) >>> 0) % 5;

    const water = planWater(el, data[LayerType.Rainfall], size);

    // base pass
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        let token = BASE_TOKEN[realmStore.biomeAt(i)] ?? "ROCKY_PLAINS";
        if (water.lake[i]) token = "LAKE";
        else if (token === "OCEAN" && el[i] < 40) token = "OCEAN_DEEP";
        drawToken(ctx, tileset, token, variant(x, y), x * CELL, y * CELL, CELL);
      }
    }
    // overlay pass, after every base tile so nothing paints over a mountain
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const biome = realmStore.biomeAt(i);
        const token =
          el[i] >= 300 || vl[i] >= 100
            ? mountainToken(el[i], vl[i])
            : FOREST_TOKEN[biome];
        if (token) {
          drawToken(ctx, tileset, token, variant(x, y), x * CELL, y * CELL, CELL);
        }
      }
    }
    // rivers last, the way the game draws them over land and mountains alike
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const token = riverToken(water, el, size, y * size + x);
        if (token) drawToken(ctx, tileset, token, variant(x, y), x * CELL, y * CELL, CELL);
      }
    }
  }, [tileset]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <div className={styles.base}>
      {!tileset && (
        <div className={styles.picker}>
          <p className={styles.lead}>See it the way the game will draw it.</p>
          <p className={styles.hint}>
            Point this at the <code>graphics</code> folder inside your Dwarf
            Fortress installation — the one containing{" "}
            <code>graphics_world_map.txt</code> and an <code>images</code>{" "}
            folder. Files are read here in your browser and never uploaded or
            stored. Graphics packs and mods work too.
          </p>
          <label className={styles.button}>
            {busy ? "Reading\u2026" : "Choose Graphics Folder"}
            <input
              className={styles.file}
              type="file"
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              multiple
              onChange={(e) => pick(e.target.files)}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {tileset && (
        <>
          <div className={styles.toolbar}>
            <button type="button" className={styles.small} onClick={draw}>
              Refresh
            </button>
            <button
              type="button"
              className={styles.small}
              onClick={() => setTileset(null)}
            >
              Change Tileset
            </button>
          </div>
          <div className={styles.canvasWrap}>
            <canvas ref={canvasRef} className={styles.canvas} />
          </div>
        </>
      )}
    </div>
  );
}
