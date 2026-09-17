import { type RealmFile, readWorldGen } from "@formats/worldgen/read";

const loaded = new Map<string, Promise<RealmFile>>();

/**
 * The first realm in a bundled preset file, fetched once per file. The gallery
 * reads it for the card, the thumbnail and loading, so it is shared.
 */
export function loadPresetFile(file: string): Promise<RealmFile> {
  let pending = loaded.get(file);
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}presets/${file}`)
      .then((response) => {
        if (!response.ok) throw new Error(`${file}: ${response.status} ${response.statusText}`);
        return response.text();
      })
      .then((text) => readWorldGen(text)[0]);
    pending.catch(() => loaded.delete(file));
    loaded.set(file, pending);
  }
  return pending;
}
