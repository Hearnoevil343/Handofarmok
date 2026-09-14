import { useDispatch, useSelector } from "react-redux";

import { Card } from "../Card/Card";
import type { RootState } from "@store/store";
import styles from "./CardsGrid.module.scss";
import { toggleSelection } from "@store/slices/gallerySlice";

export function CardsGrid() {
  const { availableBlueprints } = useSelector(
    (state: RootState) => state.gallery,
  );
  const dispatch = useDispatch();

  return (
    <div className={styles.base}>
      <div className={styles.container}>
        {availableBlueprints.map(({ title, size, withLoading }) => (
          <Card
            key={title}
            title={title}
            size={size}
            withLoading={withLoading ?? false}
            onClick={() => dispatch(toggleSelection(title))}
          />
        ))}
      </div>
    </div>
  );
}
