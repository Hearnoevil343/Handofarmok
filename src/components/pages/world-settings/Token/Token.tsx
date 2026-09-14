import {
  FREQUENCY_TOKENS,
  MESH_LABELS,
  REJECTION_TOKENS,
  bandRanges,
  maxMesh,
  meshDescription,
} from "@helpers/worldGuide";

import type { RootState } from "@store/store";
import { TokenOccurence } from "./TokenOccurence";
import styles from "./Token.module.scss";
import { useSelector } from "react-redux";

/**
 * The weighted mesh tokens are the hardest part of world generation to use,
 * because their five weights refer to bands of the min-max range rather than to
 * values. Nothing in the game tells you what those bands are, so this works
 * them out from the layer's current min and max and shows them.
 */
function FrequencyGuide({ token, params }: { token: string; params: string[] }) {
  const { presets, activePresetTitle } = useSelector((s: RootState) => s.world);
  const preset = activePresetTitle ? presets[activePresetTitle] : null;
  const info = FREQUENCY_TOKENS[token];
  if (!preset || !info) return null;

  const layer = preset.settings[info.layer]?.[0];
  const min = layer ? Number(layer[0]) : info.defaultMin;
  const max = layer ? Number(layer[1]) : info.defaultMax;
  const mesh = Number(params[0] ?? 1);
  const weights = params.slice(1).map(Number);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const bands = bandRanges(min, max);
  const cap = maxMesh(preset.size);

  return (
    <div className={styles.guide}>
      <p className={styles.guideLine}>
        <strong>{MESH_LABELS[mesh - 1] ?? mesh}</strong> &mdash;{" "}
        {meshDescription(mesh, preset.size)}
        {mesh > cap && (
          <span className={styles.warn}>
            {" "}This world is only {preset.size} tiles across; anything above{" "}
            {MESH_LABELS[cap - 1]} has grid areas too small to use.
          </span>
        )}
      </p>
      {mesh > 1 && (
        <table className={styles.bands}>
          <tbody>
            <tr>
              {bands.map(([lo, hi], i) => (
                <th key={i}>{lo}&ndash;{hi}</th>
              ))}
            </tr>
            <tr>
              {bands.map((_, i) => (
                <td key={i}>
                  {weights[i] ?? 0}
                  <span className={styles.pct}>
                    {Math.round(((weights[i] ?? 0) / total) * 100)}%
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      )}
      {mesh > 1 && (
        <p className={styles.guideLine}>
          Weights are relative, not percentages &mdash; 60:10:10:10:10 and
          6:1:1:1:1 do the same thing. They bias where grid intersections land;
          the ground between them is smoothed, so values in a band weighted zero
          still appear.
        </p>
      )}
    </div>
  );
}

export type TokenProps = {
  token: string;
  occurrences: string[][];
};

export function Token({ token, occurrences }: TokenProps) {
  const rejects = REJECTION_TOKENS.has(token);

  return (
    <div className={styles.tokenCard}>
      <div className={styles.tokenLabel}>
        {token.replace(/_+/g, " ")}
        {rejects && (
          <span
            className={styles.reject}
            title="This parameter cannot create anything. It only rejects worlds that fail to meet it, and is the most common cause of endless regeneration."
          >
            rejects
          </span>
        )}
      </div>
      <div className={styles.occurrenceList}>
        {occurrences.map((params, index) => (
          <div key={index} className={styles.parameterRow}>
            <TokenOccurence token={token} params={params} index={index} />
          </div>
        ))}
      </div>
      {FREQUENCY_TOKENS[token] && occurrences[0] && (
        <FrequencyGuide token={token} params={occurrences[0]} />
      )}
    </div>
  );
}
