# Tamriel and Skyrim world_gen presets for Dwarf Fortress

Built with **[Hand of Armok](https://github.com/Hearnoevil343/Handofarmok)**, my world builder for Dwarf Fortress: paint or import a map, run geological ages over it, and export a `world_gen.txt` that generates what you designed.

[![Tamriel as Dwarf Fortress generated it](https://gist.githubusercontent.com/Hearnoevil343/a9b56855a8a749d77284bfcadfd9029a/raw/tamriel-preview.png)](https://gist.githubusercontent.com/Hearnoevil343/a9b56855a8a749d77284bfcadfd9029a/raw/tamriel-df-map.png)

Two presets in one file, both 257x257:

- **TAMRIEL**: the whole continent, all nine provinces on one map, with Vvardenfell, Solstheim, the Summerset Isles and Thras.
- **SKYRIM**: the same world cut down to a window on one province, so Skyrim fills the whole map at two and a half times the detail. High Rock, Hammerfell, northern Cyrodiil and the Velothi wall of Morrowind run in at the edges, with no invented sea.

[![Skyrim](https://gist.githubusercontent.com/Hearnoevil343/a9b56855a8a749d77284bfcadfd9029a/raw/skyrim-preview.png)](https://gist.githubusercontent.com/Hearnoevil343/a9b56855a8a749d77284bfcadfd9029a/raw/skyrim-df-map.png)

*The embark maps straight out of Dwarf Fortress, exported by the game itself. No editing. Click a map for the full size.*

**To use:** click **Raw** on `world_gen.txt`, save it as `world_gen.txt` in your DF `prefs` folder (Steam: `%APPDATA%\Bay 12 Games\Dwarf Fortress\prefs`), then *Create new world > Detailed mode* and pick **TAMRIEL** or **SKYRIM**. This replaces your own `world_gen.txt`; to keep your presets, paste the two `[WORLD_GEN]` blocks onto the end of it instead.

**What you get:** the Elder Scrolls Online world map as DF terrain. The map paints no relief, so the coast and the lakes are read from it and the rest is built: land raised away from the coast, and every range of Tamriel drawn in by hand — the Wrothgarian and Druadach mountains, the Dragontail, the Jerall, the Throat of the World, the Velothi wall, the Valus, and Red Mountain on Vvardenfell. The climate of each province is hand-made, so Hammerfell's deserts, Skyrim's taiga and glaciers, Elsweyr's dry middle, Black Marsh's swamp green and Summerset's warm woods are where they belong. What DF does with that — rivers, coastline detail, biome edges, 250 years of history — is its own.

**Needs the normal races.** Keep the vanilla entities (dwarves, elves, humans, goblins, kobolds) turned on. A mod set that replaces them can leave civs with nowhere to settle, and DF will keep rejecting the world.

Tested: both generated 250 years of history with no errors. On the Tamriel run DF's own map-export step then crashed, which is a known Dwarf Fortress bug on big exports and not a fault of the preset — the world itself generates. For that reason the Tamriel picture above is from a run of this preset made before a small coastline fix; the two differ by about 30 coast tiles out of 32,000, which is under a pixel of what you see.

## Credit

Map data is derived from the Elder Scrolls Online world map hosted by the Unofficial Elder Scrolls Pages, stitched from its map tiles at https://maps.uesp.net/esomap/tamriel/ — with thanks to https://en.uesp.net. UESP content is CC BY-SA 2.5; the map art itself is ZeniMax's. This preset stays non-commercial.

The Elder Scrolls, Tamriel and its provinces are copyright Bethesda Softworks / ZeniMax Media.
