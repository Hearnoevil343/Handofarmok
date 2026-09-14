import { useDispatch, useSelector } from "react-redux";

import { PaintMode } from "@store/slices/paintSlice";
import { LAYER_META } from "@helpers/layerMeta";
import type { RootState } from "@store/store";
import { Slider } from "@components/widgets/Slider/Slider";
import { setScatter } from "@store/slices/paintSlice";

export function ScatterSlider() {
  const dispatch = useDispatch();
  const { scatter, paintMode } = useSelector((state: RootState) => state.paint);
  const { activeLayer, activeBiome } = useSelector((st: RootState) => st.paint);
  // meaningless on a two-state layer
  if (activeBiome === null && LAYER_META[activeLayer].control === "steps") return null;
  if (paintMode === PaintMode.Line) return null;

  return (
    <Slider
      min={0}
      max={100}
      currentValue={scatter}
      onChange={(v) => dispatch(setScatter(v))}
      label="Scatter"
      hint="Randomly skips tiles so edges break up instead of reading as a clean stamp."
    />
  );
}
