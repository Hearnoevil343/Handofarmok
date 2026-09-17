import { NavLink, useNavigate } from "react-router-dom";
import { useCallback, useEffect } from "react";
import { BrandMark } from "@components/main/BrandMark/BrandMark";
import { LookSwitcher } from "@components/main/LookSwitcher/LookSwitcher";
import cn from "classnames";
import { realmsCleared } from "@store/realmsSlice";
import styles from "./shell.module.scss";
import { useDispatch } from "react-redux";

const PAGES = [
  { label: "World Settings", path: "/world-settings", key: "F2" },
  { label: "Map", path: "/map", key: "F3" },
  { label: "Game View", path: "/game-view", key: "F4" },
  { label: "Export", path: "/export", key: "F5" },
  { label: "About", path: "/about", key: "F6" },
];

/** Brand, page links with their F-keys, the new-world action and the look picker. */
export function TopBar() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const startOver = useCallback(() => {
    if (!window.confirm("Start a new world? Every loaded realm is lost unless you exported it.")) return;
    dispatch(realmsCleared());
    navigate("/");
  }, [dispatch, navigate]);

  // F1 starts over, F2-F6 open pages. Skipped while typing in a field, and
  // with modifiers held, so browser and text shortcuts still work.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const field = (event.target as HTMLElement | null)?.tagName;
      if (field === "INPUT" || field === "TEXTAREA" || field === "SELECT") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "F1") {
        event.preventDefault();
        startOver();
        return;
      }
      const page = PAGES.find((p) => p.key === event.key);
      if (page) {
        event.preventDefault();
        navigate(page.path);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, startOver]);

  return (
    <header className={styles.topBar}>
      <span className={styles.brand}>
        <BrandMark />
        HAND OF ARMOK
      </span>

      <nav className={styles.pages}>
        <button type="button" className={styles.newWorld} onClick={startOver}>
          New World <kbd className={styles.key}>F1</kbd>
        </button>
        {PAGES.map((page) => (
          <NavLink key={page.path} to={page.path} className={({ isActive }) => cn(styles.pageLink, isActive && styles.current)}>
            {page.label} <kbd className={styles.key}>{page.key}</kbd>
          </NavLink>
        ))}
      </nav>

      <LookSwitcher />
    </header>
  );
}
