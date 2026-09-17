import { SECTIONS, type SectionId, sectionOf } from "./sections";
import { useMemo, useState } from "react";
import { QuickSetup } from "./QuickSetup/QuickSetup";
import { RealmList } from "./RealmList";
import { SectionNav } from "./SectionNav";
import { SettingRow } from "./SettingRow";
import { SettingsHeader } from "./SettingsHeader";
import { WorldAdvisor } from "./WorldAdvisor/WorldAdvisor";
import { labelOf } from "./describe";
import { selectActiveRealm } from "@store/realmsSlice";
import styles from "./worldSettings.module.scss";
import { useSelector } from "react-redux";

/**
 * One section at a time, chosen from a nav. Search cuts across sections and
 * names each hit's section, so a token can be found without knowing where it lives.
 */
export function WorldSettingsPage() {
  const realm = useSelector(selectActiveRealm);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<SectionId>("overview");

  const settings = useMemo(
    () => Object.entries(realm?.settings ?? {}).map(([token, rows]) => ({ token, rows, section: sectionOf(token) })),
    [realm],
  );
  const counts = useMemo(() => {
    const perSection: Record<string, number> = {};
    for (const s of settings) perSection[s.section] = (perSection[s.section] ?? 0) + 1;
    return perSection;
  }, [settings]);

  if (!realm) return <div className={styles.empty}>No realm is loaded.</div>;

  const query = search.trim().toLowerCase();
  const shown = query
    ? settings.filter((s) => s.token.toLowerCase().includes(query) || labelOf(s.token).toLowerCase().includes(query))
    : settings.filter((s) => s.section === section);
  const current = SECTIONS.find((s) => s.id === section)!;

  return (
    <div className={styles.page}>
      <aside className={styles.side}>
        <RealmList />
        <SectionNav
          active={section}
          counts={counts}
          onChange={(next) => {
            setSection(next);
            setSearch("");
          }}
        />
      </aside>

      <div className={styles.main}>
        <SettingsHeader search={search} onSearch={setSearch} />

        {query ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Search</h2>
            <p className={styles.blurb}>
              {shown.length} {shown.length === 1 ? "setting matches" : "settings match"}.
            </p>
            {shown.map((s) => (
              <div key={s.token}>
                <div className={styles.crumb}>{SECTIONS.find((x) => x.id === s.section)?.label}</div>
                <SettingRow token={s.token} occurrences={s.rows} />
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
            <h2 className={styles.sectionTitle}>{current.label}</h2>
            <p className={styles.blurb}>{current.blurb}</p>
            {shown.length === 0 && <p className={styles.blurb}>This realm has no settings in this section.</p>}
            {shown.map((s) => (
              <SettingRow key={s.token} token={s.token} occurrences={s.rows} />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
