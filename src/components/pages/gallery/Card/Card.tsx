import { useEffect, useMemo } from "react";

import type { RootState } from "@store/store";
import { Thumbnail } from "../Thumbnail/Thumbnail";
import cn from "classnames";
import styles from "./Card.module.scss";
import { useFetchMapData } from "@hooks/useFetchMapData";
import { useSelector } from "react-redux";

export type CardProps = {
  title: string;
  size: number;
  onClick: () => void;
  withLoading: boolean;
};

export function Card({ title, size, withLoading, onClick }: CardProps) {
  const { selectedTitles } = useSelector((state: RootState) => state.gallery);
  const filename = useMemo(() => `${title.toLowerCase()}.txt`, [title]);

  const { data, loading, fetchMap } = useFetchMapData(filename);

  useEffect(() => {
    if (withLoading && !loading && !data) {
      fetchMap();
    }
  }, [withLoading, loading, data, fetchMap]);

  return (
    <div
      key={title}
      className={cn(
        styles.base,
        selectedTitles.includes(title) && styles.base__active,
      )}
      onClick={onClick}
    >
      <Thumbnail data={data} size={size} />
      <h4 className={styles.title}>{title.replaceAll(/_/g, " ")}</h4>
      <span className={styles.size}>
        {size} x {size}
      </span>
    </div>
  );
}
