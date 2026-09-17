import { CURRENT_VERSION, type LatestRelease, RELEASES_PAGE, compareVersions, fetchLatestRelease } from "@helpers/updateCheck";
import { BrandMark } from "@components/main/BrandMark/BrandMark";
import type { ReactNode } from "react";
import styles from "./page.module.scss";
import { useState } from "react";

const REPOSITORY = "https://github.com/Hearnoevil343/Handofarmok";

type Topic = { title: string; intro?: ReactNode; items?: [string, ReactNode][] };

const TOPICS: Topic[] = [
  {
    title: "What this is",
    intro: (
      <>
        <p>
          A world builder for Dwarf Fortress. You paint elevation, rainfall, temperature, drainage, volcanism and
          savagery, and Dwarf Fortress builds its world on top of what you painted.
        </p>
        <p>
          <strong>Nothing is saved in the browser.</strong> Reloading or closing the tab loses your realms, so export
          your world_gen.txt before you go.
        </p>
      </>
    ),
  },
  {
    title: "1. Start",
    items: [
      ["New world", "Pick blank regions at any size, or generated worlds, and load them together."],
      ["Open a file", "Load a world_gen.txt to keep working on every realm in it."],
    ],
  },
  {
    title: "2. World Settings",
    items: [
      ["Quick Setup", "Dwarf Fortress's own settings ladders for history, beasts, civilisations and more, scaled to the land your realm has."],
      ["Read This World", "Measures what you built and suggests settings, including the ones that make DF reject a world forever."],
      ["Every setting", "Each world_gen token by section, with a search box to find one by name."],
      ["Prepare for painting", "Turns off what would reshape a painted map and removes counts a painted world can't meet."],
    ],
  },
  {
    title: "3. Map",
    items: [
      ["Brushes", "Biome, Sculpt, Climate, Volcano and Savagery, plus Fill and the eyedropper. Ctrl+Z undoes, Ctrl+Y redoes."],
      ["Layer locks", "A locked layer is never written, by any brush or world tool."],
      ["World tools", "Generate a world, or run it through geological ages: plates, mountains, erosion, rivers, ice ages and rising seas. Each run can be undone."],
      ["Status bar", "Shows the tile under the pointer and every value on it."],
    ],
  },
  {
    title: "4. Game View",
    intro: (
      <p>
        Point it at the graphics folder of your Dwarf Fortress install to see your world with the game&apos;s own
        world-map sprites. Files are read in your browser and never uploaded.
      </p>
    ),
  },
  {
    title: "5. Export",
    items: [
      ["world_gen.txt", "Every realm and its settings, ready for DF's prefs folder."],
      ["Heightmaps", "A zip of greyscale elevation images for PerfectWorld and other tools."],
    ],
  },
];

function UpdateCheck() {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<ReactNode>(null);

  const check = async () => {
    setChecking(true);
    setMessage(null);
    const latest: LatestRelease | null = await fetchLatestRelease();
    setChecking(false);
    if (!latest) setMessage("Couldn't reach GitHub. Check your connection and try again.");
    else if (compareVersions(latest.version, CURRENT_VERSION) <= 0) setMessage(`You have the latest version (${CURRENT_VERSION}).`);
    else
      setMessage(
        <>
          Version <strong>{latest.version}</strong> is out.{" "}
          <a href={latest.url || RELEASES_PAGE} target="_blank" rel="noopener noreferrer">
            Get it
          </a>
        </>,
      );
  };

  return (
    <div className={styles.updates}>
      <button type="button" onClick={check} disabled={checking}>
        {checking ? "Checking…" : "Check for updates"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

export function AboutPage() {
  return (
    <div className={styles.page}>
      <article className={styles.sheet}>
        <h1 className={styles.logo}>
          <BrandMark />
          <span>HAND OF ARMOK</span>
        </h1>

        {TOPICS.map((topic) => (
          <section key={topic.title} className={styles.topic}>
            <h3>{topic.title}</h3>
            {topic.intro}
            {topic.items && (
              <ul>
                {topic.items.map(([name, text]) => (
                  <li key={name}>
                    <strong>{name}:</strong> {text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className={styles.contribute}>
          <h3>Found a problem?</h3>
          <p>
            Bugs, ideas and fixes are all welcome.{" "}
            <a href={`${REPOSITORY}/issues`} target="_blank" rel="noopener noreferrer">
              Open an issue on GitHub
            </a>
            , or read the source in the{" "}
            <a href={REPOSITORY} target="_blank" rel="noopener noreferrer">
              repository
            </a>
            . Screenshots help more than descriptions.
          </p>
          <p className={styles.credit}>Dwarf Fortress is by Bay 12 Games. No game assets are included.</p>
        </section>

        <footer className={styles.footer}>
          <span className={styles.version}>Version {__APP_VERSION__}</span>
          <UpdateCheck />
        </footer>
      </article>
    </div>
  );
}
