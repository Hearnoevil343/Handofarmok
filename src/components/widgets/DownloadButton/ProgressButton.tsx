import cn from "classnames";
import styles from "./ProgressButton.module.scss";

type ProgressButtonProps = {
  progress: number;
  isError?: boolean;
  onClick: () => void;
  labels: {
    idle: string;
    loading?: string;
    success?: string;
    error?: string;
  };
  disabled?: boolean;
  classNames?: {
    base?: string;
    loading?: string;
    success?: string;
    error?: string;
    disabled?: string;
  };
};

export function ProgressButton({
  progress,
  isError,
  onClick,
  labels: {
    idle: idleLabel,
    loading: loadingLabel = "ENGRAVING...",
    success: successLabel = "SUCCESS!",
    error: errorLabel = "FORGE FAILED - TRY AGAIN",
  },
  disabled,
  classNames,
}: ProgressButtonProps) {
  const isLoading = progress > 0 && progress < 100;
  const isComplete = progress === 100 && !isError;

  return (
    <button
      className={cn(
        styles.base,
        classNames?.base,
        isLoading && styles.base__loading,
        isLoading && classNames?.loading,
        isComplete && styles.base__success,
        isComplete && classNames?.success,
        isError && styles.base__error,
        isError && classNames?.error,
        disabled && classNames?.disabled,
      )}
      onClick={onClick}
      disabled={disabled || (isLoading && !isError)}
    >
      {isLoading && !isError && (
        <div className={styles.progressBar} style={{ width: `${progress}%` }} />
      )}

      <span className={styles.btnText}>
        {isError && errorLabel}
        {!isError && progress === 0 && idleLabel}
        {!isError && isLoading && `${loadingLabel} ${progress}%`}
        {!isError && progress === 100 && successLabel}
      </span>
    </button>
  );
}
