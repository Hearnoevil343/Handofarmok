import cn from "classnames";
import styles from "./Token.module.scss";
import { updateActiveSetting } from "@store/slices/worldSlice";
import { useDispatch } from "react-redux";

export type SwitchProps = {
  token: string;
  params: string[];
  index: number;
};

export function Switch({ token, params, index }: SwitchProps) {
  const dispatch = useDispatch();

  return (
    <button
      className={cn(styles.booleanToggle, params[0] === "1" && styles.active)}
      onClick={() => {
        const newValue = params[0] === "1" ? "0" : "1";
        dispatch(
          updateActiveSetting({ key: token, index, params: [newValue] }),
        );
      }}
    >
      {params[0] === "1" ? "ENABLED" : "DISABLED"}
    </button>
  );
}
