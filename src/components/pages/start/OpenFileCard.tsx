import { type DragEvent, useState } from "react";
import cn from "classnames";
import { readWorldGen } from "@formats/worldgen/read";
import styles from "./page.module.scss";
import { useNavigate } from "react-router-dom";
import { useRealmLoader } from "@hooks/useRealmLoader";

/** Loads a world_gen.txt chosen with the file picker or dropped on the card. */
export function OpenFileCard() {
  const navigate = useNavigate();
  const { load, progress, failed } = useRealmLoader({ askPaintSafe: true });
  const [dragging, setDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const open = async (file: File | undefined) => {
    if (!file) return;
    setReadError(null);
    try {
      const realms = readWorldGen(await file.text());
      if (await load(realms)) navigate("/world-settings");
    } catch (error) {
      setReadError(error instanceof Error ? error.message : String(error));
    }
  };

  const error = readError ?? (failed ? "The realms could not be loaded." : null);
  const loading = progress > 0 && progress < 100;

  const dragProps = {
    onDragEnter: (e: DragEvent) => {
      e.preventDefault();
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDragLeave: (e: DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      open(e.dataTransfer.files[0]);
    },
  };

  return (
    <section
      className={cn(styles.card, dragging && styles.dropping, error && styles.broken)}
      onClick={() => error && setReadError(null)}
      {...dragProps}
    >
      {loading ? (
        <div className={styles.cardText}>
          <h3>Loading {progress}%</h3>
          <div className={styles.progress} style={{ width: `${progress}%` }} />
        </div>
      ) : dragging ? (
        <div className={styles.cardText}>
          <h3>Drop world_gen.txt here</h3>
          <p>Release to load every realm in it.</p>
        </div>
      ) : error ? (
        <div className={styles.cardText}>
          <h3 className={styles.errorTitle}>Could not read that file</h3>
          <p className={styles.errorText}>{error}</p>
          <p className={styles.hint}>Click to try another file</p>
        </div>
      ) : (
        <>
          <div className={styles.cardText}>
            <h3>Open a file</h3>
            <p>Load a world_gen.txt to keep editing every realm in it. You can also drop the file here.</p>
          </div>
          <label className={styles.action}>
            Open world_gen.txt
            {/* hidden visually only, so Tab still reaches the picker */}
            <input type="file" accept=".txt" className={styles.visuallyHidden} onChange={(e) => open(e.target.files?.[0])} />
          </label>
        </>
      )}
    </section>
  );
}
