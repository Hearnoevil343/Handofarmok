import { SECTIONS, type SectionId, sectionOf } from "./sections";
import { useMemo, useState } from "react";

import { HIDDEN_TOKENS } from "./constants";
import { Header } from "./Header/Header";
import { PresetsSidebar } from "./PresetsSidebar/PresetsSidebar";
import { QuickSetup } from "./QuickSetup/QuickSetup";
import type { RootState } from "@store/store";
import { SectionNav } from "./SectionNav";
import { SettingRow } from "./SettingRow";
import { WorldAdvisor } from "./WorldAdvisor/WorldAdvisor";
import { labelOf } from "./describe";
import styles from "./page.module.scss";
import { useSelector } from "react-redux";

/**
 * One section at a time, chosen from a nav — the shape every settings screen
 * converges on. Search cuts across sections and shows hits with their section
 * named, so you can find a token without knowing which drawer it lives in.
 */
export const WorldSettingsPage = () => {
  const { presets, activePresetTitle } = useSelector((s: RootState) => s.world);
  const [searchTerm, setSearchTerm] = useState("");
  const [section, setSection] = useState<SectionId>("overview");

  const activePreset = activePresetTitle ? presets[activePresetTitle] : null;

  const entries = useMemo(() => {
    if (!activePreset) return [];
    return Object.entries(activePreset.settings as Record<string, string[][]>)
      .filter(([t]) => !HIDDEN_TOKENS.includes(t))
      .map(([t, occ]) => ({ token: t, occurrences: occ, section: sectionOf(t) }));
  }, [activePreset]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries) c[e.section] = (c[e.section] ?? 0) + 1;
    return c;
  }, [entries]);

  if (!activePreset)
    return <div className={styles.empty}>No blueprints found in the archive.</div>;

  const needle = searchTerm.trim().toLowerCase();
  const searching = needle.length > 0;
  const visible = searching
    ? entries.filter((e) => e.token.toLowerCase().includes(needle) || labelOf(e.token).toLowerCase().includes(needle))
    : entries.filter((e) => e.section === section);
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className={styles.base}>
      <aside className={styles.side}>
        <PresetsSidebar />
        <SectionNav active={section} onChange={(s) => { setSection(s); setSearchTerm(""); }} counts={counts} />
      </aside>
      <main className={styles.editor}>
        <Header searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

        {searching ? (
          <section className={styles.section}>
            <h2 className={styles.title}>Search</h2>
            <p className={styles.blurb}>{visible.length} {visible.length === 1 ? "setting" : "settings"} match.</p>
            {visible.map((e) => (
              <div key={e.token}>
                <div className={styles.crumb}>{SECTIONS.find((s) => s.id === e.section)?.label}</div>
                <SettingRow token={e.token} occurrences={e.occurrences} />
              </div>
            ))}
          </section>
        ) : section === "overview" ? (
          <>
            <QuickSetup />
            <WorldAdvisor />
          </>
        ) : (
          <section className={styles.section}>
            <h2 className={styles.title}>{current.label}</h2>
            <p className={styles.blurb}>{current.blurb}</p>
            {visible.length === 0 && <p className={styles.blurb}>Nothing in this section for the current blueprint.</p>}
            {visible.map((e) => (
              <div key={e.token}>
                <SettingRow token={e.token} occurrences={e.occurrences} />
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
};
