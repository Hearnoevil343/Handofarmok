import { JsonToWorldGen } from "@utils/JsonToWorldGen";
import { useSelector } from "react-redux";
import { type RootState } from "@store/store";
import { useState } from "react";
import { ProgressButton } from "@components/widgets/DownloadButton/ProgressButton";
import styles from "./Cards.module.scss";

export function WorldGenCard() {
  const { presets } = useSelector((state: RootState) => state.world);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  const handleExport = async () => {
    setHasError(false);
    setProgress(1);

    try {
      await JsonToWorldGen.export(presets, (p) => setProgress(p));
      setTimeout(() => setProgress(0), 2000);
    } catch (e) {
      console.error(e);
      setHasError(true);
      setProgress(0);
      setTimeout(() => setHasError(false), 3000);
    }
  };

  return (
    <section className={styles.exportCard}>
      <div className={styles.cardInfo}>
        <h3>World Gen Parameters</h3>
        <p>Export your tokens and logic settings into a world_gen.txt file.</p>
      </div>

      <ProgressButton
        progress={progress}
        isError={hasError}
        onClick={handleExport}
        labels={{
          idle: "DOWNLOAD BLUEPRINT",
        }}
      />
    </section>
  );
}
