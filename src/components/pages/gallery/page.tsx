import { useDispatch, useSelector } from "react-redux";
import type { CatalogueEntry } from "@store/catalogueSlice";
import { PresetCard } from "./PresetCard";
import type { RootState } from "@store/store";
import { TaskButton } from "@components/widgets/TaskButton/TaskButton";
import { catalogueEntryToggled } from "@store/catalogueSlice";
import { newRealmSettings } from "@df/settings";
import styles from "./page.module.scss";
import { useCatalogue } from "@hooks/useCatalogue";
import { useNavigate } from "react-router-dom";
import { useRealmLoader } from "@hooks/useRealmLoader";

/** Blank regions at each of Dwarf Fortress's five world sizes. */
const BLANK_REGIONS: CatalogueEntry[] = [
  ["POCKET", 17],
  ["SMALLER", 33],
  ["SMALL", 65],
  ["MEDIUM", 129],
  ["LARGE", 257],
].map(([name, size]) => ({
  title: `${name} REGION`,
  size: size as number,
  settings: newRealmSettings(size as number),
  file: null,
}));

export function GalleryPage() {
  useCatalogue(BLANK_REGIONS);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { entries, selected } = useSelector((state: RootState) => state.catalogue);
  const { load, progress, failed } = useRealmLoader();

  const loadSelected = async () => {
    const loaded = await load(entries.filter((entry) => selected.includes(entry.title)));
    if (loaded) setTimeout(() => navigate("/world-settings"), 600);
  };

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h2>Choose realms to shape</h2>
        <p>Pick any number of blank regions or generated worlds, then load them to start.</p>
      </header>

      <div className={styles.grid}>
        {entries.map((entry) => (
          <PresetCard
            key={entry.title}
            entry={entry}
            selected={selected.includes(entry.title)}
            onToggle={() => dispatch(catalogueEntryToggled(entry.title))}
          />
        ))}
      </div>

      <TaskButton
        className={styles.load}
        doneClassName={styles.loaded}
        progress={progress}
        failed={failed}
        disabled={selected.length === 0}
        onClick={loadSelected}
        labels={{
          ready: selected.length === 1 ? "Load 1 realm" : `Load ${selected.length} realms`,
          working: "Loading maps",
          done: "Loaded",
          failed: "Loading failed, check your connection",
        }}
      />
    </div>
  );
}
