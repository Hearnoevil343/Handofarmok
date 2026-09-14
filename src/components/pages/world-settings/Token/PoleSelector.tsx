import { Selector } from "@components/widgets/Selector/Selector";
import { updateActiveSetting } from "@store/slices/worldSlice";
import { useDispatch } from "react-redux";

export type PoleSelectorProps = {
  params: string[];
  index: number;
};

const POLE_OPTIONS = [
  { label: "None", value: "NONE" },
  { label: "North Only", value: "NORTH" },
  { label: "South Only", value: "SOUTH" },
  { label: "North and South", value: "NORTH_AND_SOUTH" },
  { label: "North or South", value: "NORTH_OR_SOUTH" },
  { label: "North and/or South", value: "NORTH_AND_OR_SOUTH" },
];

export function PoleSelector({ params, index }: PoleSelectorProps) {
  const dispatch = useDispatch();

  const handlePoleChange = (newValue: string, occurrenceIndex: number) => {
    dispatch(
      updateActiveSetting({
        key: "POLE",
        index: occurrenceIndex,
        params: [newValue],
      }),
    );
  };

  return (
    <Selector
      options={POLE_OPTIONS}
      value={params[0]}
      onChange={(value) => handlePoleChange(value, index)}
    />
  );
}
