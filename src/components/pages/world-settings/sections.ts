import {
  CloudSun, Hourglass, LayoutDashboard, Layers, Mountain, ShieldAlert, Users,
  type LucideIcon,
} from "lucide-react";

import { DF_TOKEN_ORDER } from "@df/settings";
import { REJECTION_TOKENS } from "@helpers/worldGuide";

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

const CLIMATE = new Set(["TEMPERATURE", "TEMPERATURE_FREQUENCY", "RAINFALL", "RAIN_FREQUENCY",
  "RAIN_RANGES", "OROGRAPHIC_PRECIPITATION", "POLE", "PERIODICALLY_ERODE_EXTREMES",
  "EROSION_CYCLE_COUNT"]);

const HISTORY = new Set(["END_YEAR", "BEAST_END_YEAR", "REVEAL_ALL_HISTORY", "CULL_HISTORICAL_FIGURES",
  "GENERATE_DIVINE_MATERIALS", "GENERATE_MYTHICAL_MATERIALS", "MYTHICAL_SITE_NUM",
  "ALLOW_MYTHICAL_HEALING", "ALLOW_DIVINATION", "ALLOW_DEMONIC_EXPERIMENTS",
  "ALLOW_NECROMANCER_EXPERIMENTS", "ALLOW_NECROMANCER_LIEUTENANTS", "ALLOW_NECROMANCER_GHOULS",
  "ALLOW_NECROMANCER_SUMMONS"]);

const LIFE = new Set(["EMBARK_POINTS", "TOTAL_CIV_NUMBER", "TOTAL_CIV_POPULATION", "SITE_CAP",
  "PLAYABLE_CIVILIZATION_REQUIRED", "MEGABEAST_CAP", "SEMIMEGABEAST_CAP", "TITAN_NUMBER",
  "TITAN_ATTACK_TRIGGER", "DEMON_NUMBER", "NIGHT_TROLL_NUMBER", "BOGEYMAN_NUMBER", "NIGHTMARE_NUMBER",
  "VAMPIRE_NUMBER", "WEREBEAST_NUMBER", "WEREBEAST_ATTACK_TRIGGER", "SECRET_NUMBER",
  "REGIONAL_INTERACTION_NUMBER", "DISTURBANCE_INTERACTION_NUMBER", "EVIL_CLOUD_NUMBER",
  "EVIL_RAIN_NUMBER", "GOOD_SQ_COUNTS", "EVIL_SQ_COUNTS"]);

const isUnderground = (t: string) => /CAVE|CAVERN|LEVELS_|BOTTOM_LAYER|EMBARK_TUNNEL/.test(t);

function sectionFor(token: string): SectionId {
  if (REJECTION_TOKENS.has(token)) return "rejection";
  if (CLIMATE.has(token)) return "climate";
  if (HISTORY.has(token)) return "history";
  if (LIFE.has(token)) return "life";
  if (isUnderground(token)) return "underground";
  return "terrain";
}

const tokensIn = (id: SectionId) => DF_TOKEN_ORDER.filter((t) => sectionFor(t) === id);

export const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, tokens: [],
    blurb: "The fast path: size-scaled presets, and an advisor that reads the world you built." },
  { id: "terrain", label: "Terrain", icon: Mountain, tokens: tokensIn("terrain"),
    blurb: "Elevation, drainage and the weighted meshes that shape the land." },
  { id: "climate", label: "Climate", icon: CloudSun, tokens: tokensIn("climate"),
    blurb: "Temperature, rainfall, the poles and erosion." },
  { id: "life", label: "Life", icon: Users, tokens: tokensIn("life"),
    blurb: "Civilisations, beasts, night creatures, secrets and demons." },
  { id: "underground", label: "Underground", icon: Layers, tokens: tokensIn("underground"),
    blurb: "Caverns, magma and the depth of the world." },
  { id: "history", label: "History", icon: Hourglass, tokens: tokensIn("history"),
    blurb: "How long the world runs before you arrive, and what it is allowed to do." },
  { id: "rejection", label: "Rejection", icon: ShieldAlert, tokens: tokensIn("rejection"),
    blurb: "These parameters cannot create anything. They only throw worlds away, and they are the usual reason a world regenerates forever." },
];

export const sectionOf = sectionFor;
