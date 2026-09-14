import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { AboutPage } from "@components/pages/about/page";
import { ExportPage } from "@components/pages/export/page";
import { GalleryPage } from "@components/pages/gallery/page";
import { GameViewPage } from "@components/pages/game-view/page";
import { MainEditorLayout } from "@components/main/MainEditorLayout/MainEditorLayout";
import { MapPage } from "@components/pages/map/page";
import { ModalManager } from "@components/Modal/ModalManager";
import type { RootState } from "@store/store";
import { StartPage } from "@components/pages/start/page";
import { WorldSettingsPage } from "@components/pages/world-settings/page";
import { useEffect } from "react";
import { useSelector } from "react-redux";

export function App() {
  const isInitialized = useSelector(
    (state: RootState) => state.world.isInitialized,
  );

  // Nothing is stored in the browser, so a reload or a closed tab loses the
  // world without a word. Until there is real saving, at least ask first.
  useEffect(() => {
    if (!isInitialized) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isInitialized]);

  return (
    <>
      <ModalManager />
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              !isInitialized ? <StartPage /> : <Navigate to="/world-settings" />
            }
          />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route
            element={isInitialized ? <MainEditorLayout /> : <Navigate to="/" />}
          >
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
