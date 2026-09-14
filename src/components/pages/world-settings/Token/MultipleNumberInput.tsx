import styles from "./Token.module.scss";
import { updateActiveSetting } from "@store/slices/worldSlice";
import { useDispatch } from "react-redux";

export type MultipleNumberInputProps = {
  params: string[];
  token: string;
  index: number;
};

export function MultipleNumberInput({
  params,
  token,
  index,
}: MultipleNumberInputProps) {
  const dispatch = useDispatch();

  return params.map((param, parameterIndex) => (
    <input
      key={parameterIndex}
      className={styles.paramInput}
      value={param}
      onChange={(e) => {
        const newParams = [...params];
        newParams[parameterIndex] = e.target.value;
        dispatch(
          updateActiveSetting({
            key: token,
            index,
            params: newParams,
          }),
        );
      }}
    />
  ));
}
