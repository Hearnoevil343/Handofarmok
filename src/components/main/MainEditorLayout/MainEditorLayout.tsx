import { Navbar } from "../Navbar/Navbar";
import { Outlet } from "react-router-dom";
import styles from "./MainEditorLayout.module.scss";

export const MainEditorLayout = () => {
  return (
    <div className={styles.base}>
      <Navbar />
      <div className={styles.mainContent}>
        <Outlet />
      </div>
    </div>
  );
};
