import { ProgressButton } from "@components/widgets/DownloadButton/ProgressButton";
import type { RootState } from "@store/store";
import styles from "./ApplyButton.module.scss";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useWorldInitializer } from "@hooks/useWorldInitializer";

export function ApplyButton() {
  const { availableBlueprints, selectedTitles } = useSelector(
    (state: RootState) => state.gallery,
  );
  const navigate = useNavigate();
  const { init, progress, isError } = useWorldInitializer();

  const handleApply = async () => {
    const finalSelection = availableBlueprints.filter((b) =>
      selectedTitles.includes(b.title),
    );

    const success = await init(finalSelection);

    if (success) {
      setTimeout(() => navigate("/world-settings"), 600);
    }
  };

  return (
    <ProgressButton
      classNames={{ base: styles.base, success: styles.base__success }}
      progress={progress}
      isError={isError}
      onClick={handleApply}
      disabled={selectedTitles.length === 0}
      labels={{
        idle: `RESTORE ARCHIVES (${selectedTitles.length})`,
        loading: "DECRYPTING MAPS...",
        success: "ANCIENT KNOWLEDGE RESTORED!",
        error: "FORGE FAILED - CHECK NETWORK",
      }}
    />
  );
}
