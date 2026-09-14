import { useCallback, useState } from "react";

import { WorldGenToJson } from "@utils/WorldGenToJson";
import cn from "classnames";
import styles from "./Cards.module.scss";
import { useNavigate } from "react-router-dom";
import { useWorldInitializer } from "@hooks/useWorldInitializer";

export function ReclaimArchiveCard() {
  const navigate = useNavigate();
  const { init, progress, isError: fetchError } = useWorldInitializer(true);

  const [dragActive, setDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      setLocalError(null);
      try {
        const text = await file.text();
        const allPresets = WorldGenToJson.parse(text);

        const success = await init(allPresets);

        if (success) {
          navigate("/world-settings");
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setLocalError(err.message || "The scroll is unreadable.");
        }
      }
    },
    [init, navigate],
  );

  const displayError =
    localError || (fetchError ? "Failed to initialize world manager." : null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    },
    [processFile],
  );

  return (
    <div
      className={cn(
        styles.card,
        styles.reclaimCard,
        dragActive && styles.card__dragActive,
        displayError && styles.card__error,
      )}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      onClick={() => displayError && setLocalError(null)}
    >
      {progress > 0 && progress < 100 ? (
        <div className={styles.loadingContent}>
          <h3>RESTORING {progress}%</h3>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : dragActive ? (
        <div className={styles.dropZoneIndicator}>
          <h3>DROP WORLD_GEN.TXT HERE</h3>
          <p>The archives are ready to be unrolled...</p>
        </div>
      ) : displayError ? (
        <div className={styles.errorContent}>
          <h3 className={styles.errorTitle}>ARCHIVE CORRUPTED</h3>
          <p className={styles.errorMessage}>{displayError}</p>
          <span className={styles.retryHint}>Click to try another scroll</span>
        </div>
      ) : (
        <>
          <div className={styles.cardHeader}>
            <h3>RECLAIM ARCHIVE</h3>
            <p>Unroll a world_gen.txt to restore all saved blueprints.</p>
          </div>

          <label className={styles.fileLabel}>
            RESTORE FROM SCROLL
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              hidden
            />
          </label>
        </>
      )}
    </div>
  );
}
