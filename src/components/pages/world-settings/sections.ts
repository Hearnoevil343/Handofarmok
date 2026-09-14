import {
  CloudSun, Hourglass, LayoutDashboard, Layers, Mountain, ShieldAlert, Users,
  type LucideIcon,
} from "lucide-react";

import { REJECTION_TOKENS } from "@helpers/worldGuide";
import { TOKEN_CATEGORIES } from "./constants";

/**
 * Sections organised by what a player is trying to do, not by where DF keeps
 * the token. Nobody thinks "I want to adjust Rejection Parameters"; they think
 * "I want this world more dangerous", which touches beasts, night creatures,
 * secrets and demons across three of DF's categories.
 *
 * The rejection tokens get their own section on purpose. They cannot create
 * anything — they only throw worlds away — and they are the usual reason a
 * world regenerates forever. Isolating them is half of making them safe.
 */
export type SectionId =
  | "overview" | "terrain" | "climate" | "life" | "underground" | "history" | "rejection";

export type Section = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  blurb: string;
  tokens: string[];
};

const CLIMATE = new Set(["TEMPERATURE", "TEMPERATURE_FREQUENCY", "TEMPERATURE_RANGES",
  "RAINFALL", "RAIN_FREQUENCY", "RAIN_RANGES", "OROGRAPHIC_PRECIPITATION", "POLE",
  "PERIODICALLY_ERODE_EXTREMES", "EROSION_CYCLE_COUNT"]);
const TIME = new Set(["END_YEAR", "BEAST_END_YEAR", "REVEAL_ALL_HISTORY", "CULL_HISTORICAL_FIGURES",
  "GENERATE_DIVINE_MATERIALS", "ALLOW_DIVINATION", "ALLOW_DEMONIC_EXPERIMENTS",
  "ALLOW_NECROMANCER_EXPERIMENTS", "ALLOW_NECROMANCER_LIEUTENANTS", "ALLOW_NECROMANCER_GHOULS",
  "ALLOW_NECROMANCER_SUMMONS", "TOTAL_CIV_NUMBER", "TOTAL_CIV_POPULATION", "SITE_CAP",
  "PLAYABLE_CIVILIZATION_REQUIRED", "ELEVATION_RANGES", "SAVAGERY_RANGES", "VOLCANISM_RANGES",
  "DRAINAGE_RANGES"]);

function build(): Section[] {
  const all = new Set<string>(Object.values(TOKEN_CATEGORIES).flat());
  const rejection = [...all].filter((t) => REJECTION_TOKENS.has(t));
  const not = (t: string) => !REJECTION_TOKENS.has(t);

  const terrain = [...TOKEN_CATEGORIES.GEOGRAPHY, ...TOKEN_CATEGORIES.RANGES]
    .filter(not).filter((t) => !CLIMATE.has(t));
  const climate = [...TOKEN_CATEGORIES.RANGES, ...TOKEN_CATEGORIES.GEOGRAPHY]
    .filter(not).filter((t) => CLIMATE.has(t));
  const history = TOKEN_CATEGORIES.HISTORY.filter(not).filter((t) => TIME.has(t) && !t.includes("CIV") && !t.includes("SITE"));
  const life = [
    ...TOKEN_CATEGORIES.HISTORY.filter(not).filter((t) => t.includes("CIV") || t.includes("SITE") || !TIME.has(t)),
    ...TOKEN_CATEGORIES.HORRORS.filter(not),
  ];
  const underground = TOKEN_CATEGORIES.CAVERNS.filter(not);

  return [
    { id: "overview", label: "Overview", icon: LayoutDashboard, tokens: [],
      blurb: "The fast path: size-scaled presets, and an advisor that reads the world you built." },
    { id: "terrain", label: "Terrain", icon: Mountain, tokens: terrain,
      blurb: "Elevation, drainage and the weighted meshes that shape the land." },
    { id: "climate", label: "Climate", icon: CloudSun, tokens: climate,
      blurb: "Temperature, rainfall, the poles and erosion." },
    { id: "life", label: "Life", icon: Users, tokens: life,
      blurb: "Civilisations, beasts, night creatures, secrets and demons." },
    { id: "underground", label: "Underground", icon: Layers, tokens: underground,
      blurb: "Caverns, magma and the depth of the world." },
    { id: "history", label: "History", icon: Hourglass, tokens: history,
      blurb: "How long the world runs before you arrive, and what it is allowed to do." },
    { id: "rejection", label: "Rejection", icon: ShieldAlert, tokens: rejection,
      blurb: "These parameters cannot create anything. They only throw worlds away, and they are the usual reason a world regenerates forever." },
  ];
}

export const SECTIONS: Section[] = build();

export const sectionOf = (token: string): SectionId =>
  SECTIONS.find((s) => s.tokens.includes(token))?.id ?? "terrain";
