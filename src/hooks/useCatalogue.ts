import { useEffect } from "react";
import { catalogueEntriesAdded, type CatalogueEntry } from "@store/catalogueSlice";
import { loadPresetFile } from "./presetFiles";
import { useDispatch } from "react-redux";

/** Adds `templates`, then every bundled preset listed in presets/index.json. */
export function useCatalogue(templates: CatalogueEntry[]): void {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(catalogueEntriesAdded(templates));
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}presets/index.json`);
        if (!response.ok) throw new Error(`presets/index.json: ${response.status}`);
        const files: string[] = await response.json();
        for (const file of files) {
          try {
            const realm = await loadPresetFile(file);
            if (cancelled) return;
            const title = (realm.title || file.replace(/\.txt$/, "")).toUpperCase();
            dispatch(catalogueEntriesAdded([{ title, size: realm.size, settings: realm.settings, file }]));
          } catch (error) {
            console.error(`Could not read preset ${file}:`, error);
          }
        }
      } catch (error) {
        console.error("Could not read the preset list:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dispatch, templates]);
}
