import { ProgressButton } from "@components/widgets/DownloadButton/ProgressButton";
import styles from "./Cards.module.scss";
import { useState } from "react";

/**
 * Dwarf Fortress's own default world_gen.txt, as the game writes it, kept in
 * the app so a player whose prefs/world_gen.txt has been broken or overwritten
 * can put the original back without reinstalling. It goes in
 * %APPDATA%\Bay 12 Games\Dwarf Fortress\prefs\.
 */
export function OriginalWorldGenCard() {
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  const handleDownload = async () => {
    setHasError(false);
    setProgress(1);
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}df/world_gen_original.txt`);
      if (!response.ok) throw new Error(`Could not load the original file (${response.status})`);
      const blob = new Blob([await response.text()], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "world_gen.txt";
      link.click();
      URL.revokeObjectURL(url);
      setProgress(100);
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
        <h3>Original DF World Gen File</h3>
        <p>
          The world_gen.txt Dwarf Fortress creates on its own, with its ten
          standard regions and islands. Use it to replace a broken or
          overwritten file in Dwarf Fortress&apos;s prefs folder.
        </p>
      </div>

      <ProgressButton
        progress={progress}
        isError={hasError}
        onClick={handleDownload}
        labels={{
          idle: "DOWNLOAD ORIGINAL DF WORLD GEN FILE",
        }}
      />
    </section>
  );
}
