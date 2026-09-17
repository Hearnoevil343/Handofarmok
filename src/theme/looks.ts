/**
 * The available UI looks (docs/ui-rework.md). A look changes colours, fonts
 * and panel layout; it never changes the map, the brushes, or what any tool
 * does.
 *
 * `available: false` looks are listed (so the switcher can show what's coming)
 * but cannot be selected — reserved for Cartographer, built last on purpose.
 */
export type LookId = "fortress" | "glass" | "cartographer";

export type LookOption = {
  id: LookId;
  label: string;
  available: boolean;
};

export const LOOKS: readonly LookOption[] = [
  { id: "fortress", label: "Fortress", available: true },
  { id: "glass", label: "Glass Inspector", available: true },
  { id: "cartographer", label: "Cartographer", available: false },
];

export const DEFAULT_LOOK: LookId = "fortress";

export function isAvailableLook(id: string | null | undefined): id is LookId {
  return LOOKS.some((l) => l.id === id && l.available);
}
