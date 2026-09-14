import { useDispatch, useSelector } from "react-redux";
import { LAYER_META } from "@helpers/layerMeta";
import { type RootState } from "@store/store";
import { setBrushOpacity } from "@store/slices/paintSlice";
import { Slider } from "@components/widgets/Slider/Slider";

export function BrushOpacitySlider() {
  const dispatch = useDispatch();
  const { opacity } = useSelector((state: RootState) => state.paint);
  const { activeLayer, activeBiome } = useSelector((st: RootState) => st.paint);
  // meaningless on a two-state layer
  if (activeBiome === null && LAYER_META[activeLayer].control === "steps") return null;

  return (
    <Slider
      max={1}
      step={0.01}
      currentValue={opacity}
      onChange={(value) => dispatch(setBrushOpacity(value))}
      label="Opacity"
    />
  );
}
