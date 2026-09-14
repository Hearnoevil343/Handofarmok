import type { WorldPreset, WorldSettings } from "#types";

import { ApplyButton } from "./ApplyButton/ApplyButton";
import { CardsGrid } from "./CardsGrid/CardsGrid";
import { DEFAULT_CONFIG } from "@store/configs";
import { isArrayOfArrays } from "@helpers/typeGuards";
import { setAvailableBlueprints } from "@store/slices/gallerySlice";
import styles from "./page.module.scss";
import { useDispatch } from "react-redux";
import { useEffect } from "react";
import { useFetchCustomPresets } from "@hooks/useFetchCustomPresets";

const sizes = [
  { name: "POCKET", dim: 17 },
  { name: "SMALLER", dim: 33 },
  { name: "SMALL", dim: 65 },
  { name: "MEDIUM", dim: 129 },
  { name: "LARGE", dim: 257 },
];

const createStandardTemplates = () => {
  const templates: WorldPreset[] = [];

  for (const s of sizes) {
    const settings: WorldSettings = {
      DIM: [[String(s.dim), String(s.dim)]],
    };

    Object.entries(DEFAULT_CONFIG).forEach(([key, value]) => {
      if (isArrayOfArrays<string>(value)) {
        settings[key] = value;
      } else {
        settings[key] = [value];
      }
    });

    templates.push({
      title: `${s.name} REGION`,
      size: s.dim,
      settings,
      mapData: null,
    });
  }

  return templates;
};

export function GalleryPage() {
  const dispatch = useDispatch();
  useFetchCustomPresets();

  useEffect(() => {
    dispatch(setAvailableBlueprints(createStandardTemplates()));
  }, [dispatch]);

  return (
    <div className={styles.base}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 className={styles.title}>CHOOSE YOUR BLUEPRINTS</h2>
          <p className={styles.description}>
            Select the ancient scrolls you wish to study and reshape.
          </p>
        </header>
        <CardsGrid />
      </div>
      <ApplyButton />
    </div>
  );
}
