import cn from "classnames";
import styles from "./TaskButton.module.scss";

export type TaskButtonProps = {
  /** 0 ready, 1-99 working, 100 done */
  progress: number;
  failed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  labels: { ready: string; working?: string; done?: string; failed?: string };
  className?: string;
  doneClassName?: string;
};

/** A button for a job that takes a moment: it fills as the job runs, then says how it went. */
export function TaskButton({ progress, failed, disabled, onClick, labels, className, doneClassName }: TaskButtonProps) {
  const working = !failed && progress > 0 && progress < 100;
  const done = !failed && progress >= 100;
  const text = failed
    ? (labels.failed ?? "Failed, try again")
    : working
      ? `${labels.working ?? "Working"} ${progress}%`
      : done
        ? (labels.done ?? "Done")
        : labels.ready;

  return (
    <button
      type="button"
      className={cn(styles.button, className, working && styles.working, done && styles.done, done && doneClassName, failed && styles.failed)}
      onClick={onClick}
      disabled={disabled || working}
    >
      {working && <span className={styles.fill} style={{ width: `${progress}%` }} />}
      <span className={styles.text}>{text}</span>
    </button>
  );
}
