import { AlertTriangle } from "lucide-react";
import { DESCRIBE, labelOf } from "./describe";
import { REJECTION_TOKENS } from "@helpers/worldGuide";
import { TokenEditor } from "./TokenEditor";
import cn from "classnames";
import styles from "./SettingRow.module.scss";

/**
 * One setting: a human label, the control, a line of help, and the raw token
 * name in small monospace for anyone who wants it. TokenEditor picks the
 * control: size, pole, on/off, numbers, and the weighted-mesh guide.
 */
export function SettingRow({ token, occurrences }: { token: string; occurrences: string[][] }) {
  const d = DESCRIBE[token];
  const rejects = REJECTION_TOKENS.has(token);
  return (
    <div className={cn(styles.row, rejects && styles.rejects)}>
      <div className={styles.meta}>
        <div className={styles.label}>
          {labelOf(token)}
          {rejects && (
            <span className={styles.badge} title="Cannot create anything; only rejects worlds that fail it">
              <AlertTriangle size={11} /> rejects
            </span>
          )}
        </div>
        {d?.help && <div className={styles.help}>{d.help}</div>}
        <code className={styles.token}>{token}</code>
      </div>
      <div className={styles.control}>
        <TokenEditor token={token} rows={occurrences} />
      </div>
    </div>
  );
}
