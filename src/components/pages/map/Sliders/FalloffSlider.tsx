import { FALLOFF_KINDS, type FalloffKind } from "@helpers/brushEngine";
import { setFalloff, setFalloffKind } from "@store/slices/paintSlice";
import { useDispatch, useSelector } from "react-redux";

import { PaintMode } from "@store/slices/paintSlice";
import { LAYER_META } from "@helpers/layerMeta";
import type { RootState } from "@store/store";
import { Selector } from "@components/widgets/Selector/Selector";
import { Slider } from "@components/widgets/Slider/Slider";

export function FalloffSlider() {
  const dispatch = useDispatch();
  const { falloff, falloffKind, paintMode } = useSelector(
    (state: RootState) => state.paint,
  );
  const { activeLayer, activeBiome, activeTool } = useSelector((st: RootState) => st.paint);
  // meaningless on a two-state layer, and the Climate brush stamps its value
  if (activeBiome === null && LAYER_META[activeLayer].control === "steps") return null;
  if (activeTool === "climate") return null;
  if (paintMode === PaintMode.Line) return null;

  return (
    <>
      <Slider
        min={0}
        max={100}
        currentValue={falloff}
        onChange={(v) => dispatch(setFalloff(v))}
        label="Falloff"
        hint="0 is a hard edge. Higher softens outward from the centre, which is what makes gradients look natural."
        markers={[
          { at: 0, label: "hard" },
          { at: 100, label: "soft" },
        ]}
      />
      {falloff > 0 && (
        <Selector
          value={falloffKind}
          options={FALLOFF_KINDS.map((f) => ({ label: f.label, value: f.id }))}
          onChange={(v) => dispatch(setFalloffKind(v as FalloffKind))}
        />
      )}
    </>
  );
}
