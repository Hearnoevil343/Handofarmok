import type { RootState } from "@store/store";
import { TaskButton } from "@components/widgets/TaskButton/TaskButton";
import { buildHeightmapZip } from "@formats/heightmapZip";
import { realmStore } from "@world/realmStore";
import { saveFile } from "@formats/download";
import styles from "./page.module.scss";
import { useSelector } from "react-redux";
import { useState } from "react";
import { writeWorldGen } from "@formats/worldgen/write";

/** Where to get Dwarf Fortress's own default world_gen.txt. DF does not ship the file. */
const DF_WIKI_DEFAULTS = "https://dwarffortresswiki.org/index.php/World_gen.txt/raw";

/** Runs a download job with a progress value and a failed flag for a TaskButton. */
function useJob(job: (report: (done: number) => void) => Promise<void>) {
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setFailed(false);
    setProgress(1);
    try {
      await job((done) => setProgress(Math.max(1, Math.floor(done * 100))));
      setProgress(100);
      setTimeout(() => setProgress(0), 2000);
    } catch (error) {
      console.error(error);
      setProgress(0);
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };
  return { run, progress, failed };
}

export function ExportPage() {
  const realms = useSelector((state: RootState) => state.realms.byTitle);

  const worldGen = useJob(async (report) => {
    const text = await writeWorldGen(
      Object.values(realms).map((realm) => ({ ...realm, layers: realmStore.layersOf(realm.title)! })),
      report,
    );
    saveFile(text, "world_gen.txt");
  });

  const heightmaps = useJob(async (report) => {
    const zip = await buildHeightmapZip(
      Object.values(realms).map(({ title, size }) => ({ title, size, elevation: realmStore.layersOf(title)!.elevation })),
      report,
    );
    saveFile(zip, "hand_of_armok_heightmaps.zip");
  });

  return (
    <div className={styles.page}>
      <h2 className={styles.heading}>Export</h2>
      <div className={styles.grid}>
        <section className={styles.card}>
          <div>
            <h3>world_gen.txt</h3>
            <p>
              Every loaded realm, with its map and settings, in one file. Put it in Dwarf Fortress&apos;s
              prefs folder and pick a realm when you create a world.
            </p>
          </div>
          <TaskButton
            progress={worldGen.progress}
            failed={worldGen.failed}
            onClick={worldGen.run}
            labels={{ ready: "Download world_gen.txt", working: "Writing", done: "Saved" }}
          />
        </section>

        <section className={styles.card}>
          <div>
            <h3>PerfectWorld heightmaps</h3>
            <p>A zip with one greyscale elevation image per realm, 257 pixels square.</p>
          </div>
          <TaskButton
            progress={heightmaps.progress}
            failed={heightmaps.failed}
            onClick={heightmaps.run}
            labels={{ ready: "Download heightmaps", working: "Drawing", done: "Saved" }}
          />
        </section>

        <section className={styles.card}>
          <div>
            <h3>Dwarf Fortress defaults</h3>
            <p>
              Dwarf Fortress&apos;s default world_gen.txt, with its ten standard regions and islands, is on the DF
              Wiki. Copy it into %APPDATA%\Bay 12 Games\Dwarf Fortress\prefs\world_gen.txt to replace a broken
              or overwritten file.
            </p>
          </div>
          <a className={styles.link} href={DF_WIKI_DEFAULTS} target="_blank" rel="noopener noreferrer">
            Open the default file on the DF Wiki
          </a>
        </section>
      </div>
    </div>
  );
}
