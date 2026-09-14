import { useDispatch, useSelector } from "react-redux";
import { type RootState } from "@store/store";
import { setBrushWidth } from "@store/slices/paintSlice";
import { Slider } from "@components/widgets/Slider/Slider";

export function BrushSizeSlider() {
  const dispatch = useDispatch();
  const { brushWidth } = useSelector((state: RootState) => state.paint);

  return (
    <Slider
      min={1}
      max={21}
      step={2}
      currentValue={brushWidth}
      onChange={(value) => dispatch(setBrushWidth(value))}
      label="Size"
      hint="Diameter in world tiles. One tile is about 1.9 km, so a size of 5 covers roughly 9 km across."
    />
  );
}
