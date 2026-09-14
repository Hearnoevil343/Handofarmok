import { BOOLEAN_TOKENS } from "../constants";
import { DimensionSelector } from "./DimensionSelector";
import { MultipleNumberInput } from "./MultipleNumberInput";
import { PoleSelector } from "./PoleSelector";
import { Switch } from "./Switch";

export type TokenOccurenceProps = {
  token: string;
  params: string[];
  index: number;
};

export function TokenOccurence({ token, params, index }: TokenOccurenceProps) {
  if (token === "DIM") {
    return <DimensionSelector params={params} index={index} />;
  }

  if (token === "POLE") {
    return <PoleSelector params={params} index={index} />;
  }

  if (BOOLEAN_TOKENS.includes(token)) {
    return <Switch token={token} params={params} index={index} />;
  }

  return <MultipleNumberInput params={params} token={token} index={index} />;
}
