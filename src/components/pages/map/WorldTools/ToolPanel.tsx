import type { ReactNode } from "react";
import styles from "./WorldTools.module.scss";

export function ToolPanel({
  title,
  blurb,
  open,
  children,
}: {
  title: string;
  blurb: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={styles.panel} open={open}>
      <summary className={styles.summary}>{title}</summary>
      <p className={styles.blurb}>{blurb}</p>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
