import { HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AboutPage } from "@components/pages/about/page";
import { DialogHost } from "@components/dialogs/DialogHost";
import { ExportPage } from "@components/pages/export/page";
import { GalleryPage } from "@components/pages/gallery/page";
import { GameViewPage } from "@components/pages/game-view/page";
import { MapPage } from "@components/pages/map/page";
import type { RootState } from "@store/store";
import { StartPage } from "@components/pages/start/page";
import { TopBar } from "./TopBar";
import { UpdateNotice } from "@components/main/UpdateNotice/UpdateNotice";
import { WorldSettingsPage } from "@components/pages/world-settings/page";
import styles from "./shell.module.scss";
import { useEffect } from "react";
import { useSelector } from "react-redux";

/** Top bar plus the current editor page. */
function EditorLayout() {
  return (
    <div className={styles.editor}>
      <TopBar />
      <main className={styles.page}>
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  const loaded = useSelector((state: RootState) => state.realms.loaded);
  const look = useSelector((state: RootState) => state.ui.look);

  // Every themed style is a variable under :root[data-look] (styles/looks), so
  // switching look is one attribute write and never remounts the map.
  useEffect(() => {
    document.documentElement.dataset.look = look;
  }, [look]);

  // Nothing is saved in the browser yet, so ask before a reload or close
  // throws the realms away.
  useEffect(() => {
    if (!loaded) return;
    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [loaded]);

  return (
    <>
      <DialogHost />
      <UpdateNotice />
      <HashRouter>
        <Routes>
          <Route path="/" element={loaded ? <Navigate to="/world-settings" /> : <StartPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route element={loaded ? <EditorLayout /> : <Navigate to="/" />}>
            <Route path="/world-settings" element={<WorldSettingsPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/game-view" element={<GameViewPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </>
  );
}
