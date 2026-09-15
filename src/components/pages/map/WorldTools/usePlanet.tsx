import {
  DEFAULT_PLANET, EARTH_TILT_DEG, type Planet, type PoleLayout, layoutForPoleToken,
} from "@engine/index";
import { type ReactNode, useState } from "react";

import type { RootState } from "@store/store";
import { Selector } from "@components/widgets/Selector/Selector";
import { Slider } from "@components/widgets/Slider/Slider";
import { selectActivePreset } from "@store/selectors";
import styles from "./WorldTools.module.scss";
import { useSelector } from "react-redux";

type LayoutChoice = "POLE_SETTING" | PoleLayout;

const LAYOUT_NAME: Record<PoleLayout, string> = {
  WHOLE: "whole planet",
  NORTH: "northern hemisphere",
  SOUTH: "southern hemisphere",
};

/**
 * The planet the climate follows: pole layout, spin and axial tilt
 * (src/engine/planet.ts). The layout follows the Poles setting on the World
 * Settings page unless the player picks one here; DF's random "or" options are
 * rolled from the seed so the simulation has one definite answer.
 */
export function usePlanet(seed: number): { planet: Planet; fields: ReactNode } {
  const poleToken = useSelector((s: RootState) => selectActivePreset(s)?.settings.POLE?.[0]?.[0]);
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>("POLE_SETTING");
  const [spin, setSpin] = useState<1 | -1>(1);
  const [tilt, setTilt] = useState(Math.round(DEFAULT_PLANET.tiltDeg));

  const fromSetting = layoutForPoleToken(poleToken, seed);
  const planet: Planet = {
    layout: layoutChoice === "POLE_SETTING" ? fromSetting : layoutChoice,
    spin,
    // the slider moves in whole degrees; its Earth mark is Earth's exact tilt
    tiltDeg: tilt === Math.round(EARTH_TILT_DEG) ? EARTH_TILT_DEG : tilt,
  };

  const fields = (
    <>
      <span className={styles.field}>Pole Layout</span>
      <Selector
        value={layoutChoice}
        options={[
          { label: `Follow the Poles setting (${LAYOUT_NAME[fromSetting]})`, value: "POLE_SETTING" },
          { label: "Whole planet", value: "WHOLE" },
          { label: "Northern hemisphere", value: "NORTH" },
          { label: "Southern hemisphere", value: "SOUTH" },
        ]}
        onChange={(v) => setLayoutChoice(v as LayoutChoice)}
      />
      <span className={styles.field}>Spin</span>
      <Selector
        value={String(spin)}
        options={[
          { label: "Prograde, like Earth", value: "1" },
          { label: "Retrograde, like Venus", value: "-1" },
        ]}
        onChange={(v) => setSpin(v === "-1" ? -1 : 1)}
      />
      <Slider min={0} max={90} currentValue={tilt} onChange={setTilt} label="Axial Tilt"
        markers={[{ at: Math.round(EARTH_TILT_DEG), label: "earth" }]}
        hint="How the year's sunlight is spread over latitude. Near 54 degrees the equator and the poles get about the same; beyond that the poles are warmer than the equator. Reversing the spin swaps which coasts are wet and which are dry." />
    </>
  );
  return { planet, fields };
}
