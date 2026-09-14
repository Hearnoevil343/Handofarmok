import { updateActiveSetting } from "@store/slices/worldSlice";
import { type RootState } from "@store/store";
import { useDispatch, useSelector } from "react-redux";
import { Selector } from "@components/widgets/Selector/Selector";

export type DimensionSelectorProps = {
  params: string[];
  index: number;
};

const WORLD_SIZES = [
  { label: "Pocket (17×17)", value: "17" },
  { label: "Smaller (33×33)", value: "33" },
  { label: "Small (65×65)", value: "65" },
  { label: "Medium (129×129)", value: "129" },
  { label: "Large (257×257)", value: "257" },
];

export function DimensionSelector({ params, index }: DimensionSelectorProps) {
  const dispatch = useDispatch();
  const activePresetTitle = useSelector(
    (state: RootState) => state.world.activePresetTitle,
  );

  const handleDimChange = (newSize: string, occurrenceIndex: number) => {
    if (!activePresetTitle) return;

    const confirmChange = window.confirm(
      "Changing dimensions will clear all current drawings on this blueprint. Proceed?",
    );
    if (!confirmChange) return;

    const newParams = [newSize, newSize];

    dispatch(
      updateActiveSetting({
        key: "DIM",
        index: occurrenceIndex,
        params: newParams,
      }),
    );
  };

  return (
    <Selector
      options={WORLD_SIZES}
      value={params[0]}
      onChange={(value) => handleDimChange(value, index)}
    />
  );
}
