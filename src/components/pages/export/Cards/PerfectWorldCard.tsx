import { ImageExporter } from "@utils/ImageExporter";
import { ProgressButton } from "@components/widgets/DownloadButton/ProgressButton";
import styles from "./Cards.module.scss";
import { useState } from "react";

export function PerfectWorldCard() {
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  const handleExport = async () => {
    setHasError(false);
    setProgress(1);

    try {
      await ImageExporter.exportAllElevationForPerfectWorld((p) =>
        setProgress(p),
      );
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
        <h3>PerfectWorld Heightmap</h3>
        <p>Extract the elevation strata as a bitmap.</p>
      </div>

      <div className={styles.buttonGroup}>
        <ProgressButton
          progress={progress}
          isError={hasError}
          onClick={handleExport}
          labels={{
            idle: "DOWNLOAD HEIGHTMAP",
          }}
        />
      </div>
    </section>
  );
}
