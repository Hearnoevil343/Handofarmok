import { FLAG_TOKENS } from "@df/settings";
import { FREQUENCY_TOKENS, MESH_LABELS, bandRanges, maxMesh, meshDescription } from "@helpers/worldGuide";
import { useDispatch, useSelector } from "react-redux";
import { AlertTriangle } from "lucide-react";
import { Dropdown } from "@components/widgets/Dropdown/Dropdown";
import type { RootState } from "@store/store";
import cn from "classnames";
import { realmSettingSet } from "@store/realmsSlice";
import styles from "./tokenEditor.module.scss";

/** DF's five world sizes, in tiles per side. */
const WORLD_SIZES = [17, 33, 65, 129, 257].map((tiles, i) => ({
  label: `${["Pocket", "Smaller", "Small", "Medium", "Large"][i]}: ${tiles} × ${tiles} tiles`,
  value: String(tiles),
}));

const POLES = [
  { label: "No poles", value: "NONE" },
  { label: "North", value: "NORTH" },
  { label: "South", value: "SOUTH" },
  { label: "North and south", value: "NORTH_AND_SOUTH" },
  { label: "North or south (random)", value: "NORTH_OR_SOUTH" },
  { label: "North, south or both (random)", value: "NORTH_AND_OR_SOUTH" },
];

type RowProps = { token: string; row: number; params: string[] };

/** The right control for one row of a token: size, pole, on/off, or numbers. */
function RowControl({ token, row, params }: RowProps) {
  const dispatch = useDispatch();
  const set = (next: string[]) => dispatch(realmSettingSet({ token, row, params: next }));

  if (token === "DIM") {
    return (
      <Dropdown
        options={WORLD_SIZES}
        value={params[0]}
        onChange={(size) => {
          if (window.confirm("Changing the size clears this realm's map. Continue?")) set([size, size]);
        }}
      />
    );
  }

  if (token === "POLE") {
    return (
      <div className={styles.stack}>
        <Dropdown options={POLES} value={params[0]} onChange={(pole) => set([pole])} />
        {params[0] !== "NONE" && (
          <p className={styles.poleWarning}>
            <AlertTriangle size={13} />
            Dwarf Fortress&apos;s own climate overwrites your painted temperature wherever a pole is set. Rainfall is
            not affected. Choose No poles to keep the temperature you painted.
          </p>
        )}
      </div>
    );
  }

  if (FLAG_TOKENS.has(token)) {
    const on = params[0] === "1";
    return (
      <button type="button" className={cn(styles.flag, on && styles.flagOn)} aria-pressed={on} onClick={() => set([on ? "0" : "1"])}>
        {on ? "On" : "Off"}
      </button>
    );
  }

  return (
    <>
      {params.map((value, i) => (
        <input
          key={i}
          className={styles.number}
          value={value}
          onChange={(e) => set(params.map((v, j) => (j === i ? e.target.value : v)))}
        />
      ))}
    </>
  );
}

/**
 * The mesh tokens weight five bands of a layer's min-max range, and nothing in
 * the game says what those bands are. This works them out and shows them.
 */
function FrequencyGuide({ token, params }: { token: string; params: string[] }) {
  const realm = useSelector((state: RootState) => (state.realms.activeTitle ? state.realms.byTitle[state.realms.activeTitle] : null));
  const info = FREQUENCY_TOKENS[token];
  if (!realm || !info) return null;

  const range = realm.settings[info.layer]?.[0];
  const min = range ? Number(range[0]) : info.defaultMin;
  const max = range ? Number(range[1]) : info.defaultMax;
  const mesh = Number(params[0] ?? 1);
  const weights = params.slice(1).map(Number);
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  const largest = maxMesh(realm.size);

  return (
    <div className={styles.guide}>
      <p>
        <strong>{MESH_LABELS[mesh - 1] ?? mesh}</strong> &mdash; {meshDescription(mesh, realm.size)}
        {mesh > largest && (
          <span className={styles.warn}>
            {" "}
            This world is only {realm.size} tiles across; anything above {MESH_LABELS[largest - 1]} has grid areas too
            small to use.
          </span>
        )}
      </p>
      {mesh > 1 && (
        <>
          <table className={styles.bands}>
            <tbody>
              <tr>
                {bandRanges(min, max).map(([lo, hi]) => (
                  <th key={`${lo}-${hi}`}>
                    {lo}&ndash;{hi}
                  </th>
                ))}
              </tr>
              <tr>
                {bandRanges(min, max).map((_, i) => (
                  <td key={i}>
                    {weights[i] ?? 0}
                    <span className={styles.share}>{Math.round(((weights[i] ?? 0) / total) * 100)}%</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p>
            Weights are relative, not percentages &mdash; 60:10:10:10:10 and 6:1:1:1:1 do the same thing. They bias
            where grid intersections land; the ground between them is smoothed, so values in a band weighted zero still
            appear.
          </p>
        </>
      )}
    </div>
  );
}

/** Editor for every row of one world_gen token. */
export function TokenEditor({ token, rows }: { token: string; rows: string[][] }) {
  return (
    <div className={styles.editor}>
      {rows.map((params, row) => (
        <div key={row} className={styles.row}>
          <RowControl token={token} row={row} params={params} />
        </div>
      ))}
      {FREQUENCY_TOKENS[token] && rows[0] && <FrequencyGuide token={token} params={rows[0]} />}
    </div>
  );
}
