# Azeroth world_gen presets for Dwarf Fortress

Built with **[Hand of Armok](https://github.com/Hearnoevil343/Handofarmok)**, my world builder for Dwarf Fortress: paint or import a map, run geological ages over it, and export a `world_gen.txt` that generates what you designed.

[![Azeroth as Dwarf Fortress generated it](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/azeroth-preview.png)](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/azeroth-df-map.png)

Three presets in one file, all 257x257:

- **AZEROTH**: both continents of World of Warcraft Classic side by side.
- **KALIMDOR**: Kalimdor alone, filling the whole map.
- **EASTERN KINGDOMS**: the Eastern Kingdoms alone, filling the whole map.

[![Kalimdor](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/kalimdor-preview.png)](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/kalimdor-df-map.png)

[![Eastern Kingdoms](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/eastern-kingdoms-preview.png)](https://gist.githubusercontent.com/Hearnoevil343/53680866c9fa24202d307d94a2e3551f/raw/eastern-kingdoms-df-map.png)

*The embark maps straight out of Dwarf Fortress, stitched from screenshots. No editing. Click a map for the full size.*

**To use:** click **Raw** on `world_gen.txt`, save it as `world_gen.txt` in your DF `prefs` folder (Steam: `%APPDATA%\Bay 12 Games\Dwarf Fortress\prefs`), then *Create new world > Detailed mode* and pick **AZEROTH**, **KALIMDOR** or **EASTERN KINGDOMS**. This replaces your own `world_gen.txt`; to keep your presets, paste the three `[WORLD_GEN]` blocks onto the end of it instead.

**What you get:** the Classic terrain map as DF terrain. Teldrassil, the ring of Mount Hyjal, the Barrens, Desolace and Silithus, Un'Goro Crater, the snowy peaks of Alterac and Khaz Modan, and the Stranglethorn jungle are all what DF generated from the preset.

**Needs the normal races.** Keep the vanilla entities (dwarves, elves, humans, goblins, kobolds) turned on. A mod set that replaces them can leave civs with nowhere to settle, and DF will keep rejecting the world.

Tested: all three generated to year 250 in the DF UI without errors.

## Credit

Map data is derived from teebling's hand-stitched high resolution terrain map of World of Warcraft Classic (https://www.warcrafttavern.com/community/art-resources/high-resolution-terrain-maps-of-azeroth/), with thanks to https://barrens.chat. Free for non-commercial use with credit, so these presets are non-commercial too.

World of Warcraft, Azeroth and its places are copyright Blizzard Entertainment.
