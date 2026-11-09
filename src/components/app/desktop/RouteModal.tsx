import { CenterPopup } from "antd-mobile";
import { ReactNode, useRef } from "react";
import { Location, matchPath, Routes, useLocation, useNavigate } from "react-router-dom";
import { useBreakpoint } from "../../../hooks/use-windows-dimensions";

// on large screens these routes open in a centered modal over the page they were opened from
// instead of replacing it (on phones they stay full pages)
const MODAL_ROUTES = [
  "/chat/:account/info",
  "/chat/:account/info/groups",
  "/chat/:account/group",
  "/chat/red-packet-result",
  "/me/settings",
  "/settings/*",
];
// multi-step flow that can be forced (migration): a full page, a mask click must not dismiss it
const FULL_PAGE_ROUTES = ["/settings/change-secret-phrase"];

export const isModalRoute = (pathname: string) =>
  !FULL_PAGE_ROUTES.some((pattern) => matchPath(pattern, pathname)) &&
  MODAL_ROUTES.some((pattern) => matchPath(pattern, pathname));

// page shown behind the modal when there is no previous page to show (deep link, reload)
const fallbackBackground = (pathname: string): Location => ({
  pathname: pathname.startsWith("/chat") ? "/chat" : "/me",
  search: "",
  hash: "",
  state: null,
  key: "route-modal-background",
});

const historyIndex = (): number | undefined => window.history.state?.idx; // set by react-router's BrowserRouter

/**
 * Returns the location the main <Routes> should render (the page behind the modal while one is open,
 * the current location otherwise) and the modal itself, which renders `children` routes against the
 * current location. Rendering the main routes against the remembered page keeps it mounted as is
 * (open chat, scroll position) while the modal is open.
 */
export function useRouteModal(children: ReactNode) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useBreakpoint();
  const isOpen = !isMobile && isModalRoute(location.pathname);

  const backgroundRef = useRef<Location | null>(null);
  const openIndexRef = useRef<number | undefined>(undefined); // history index of the first modal entry
  const lastModalLocationRef = useRef<Location | null>(null); // keeps the content during the close animation
  if (!isOpen) {
    backgroundRef.current = location;
    openIndexRef.current = undefined;
  } else {
    if (openIndexRef.current === undefined) openIndexRef.current = historyIndex();
    lastModalLocationRef.current = location;
  }

  const close = () => {
    const current = historyIndex();
    const opened = openIndexRef.current;
    if (backgroundRef.current && opened !== undefined && opened > 0 && current !== undefined) {
      // back to the page the modal was opened from, dropping the modal entries (also after navigating inside it)
      navigate(opened - 1 - current);
    } else {
      navigate(fallbackBackground(location.pathname).pathname, { replace: true });
    }
  };

  const background = isOpen ? backgroundRef.current ?? fallbackBackground(location.pathname) : location;

  const modal = (
    <CenterPopup
      visible={isOpen}
      onMaskClick={close}
      onClose={close}
      destroyOnClose
      className="route-modal"
      style={{
        "--min-width": "min(600px, calc(100vw - 32px))",
        "--max-width": "min(600px, calc(100vw - 32px))",
        "--border-radius": "16px",
        "--background-color": "var(--main-background-color)",
      } as React.CSSProperties}
      bodyStyle={{ maxHeight: "85vh", overflowY: "auto", overscrollBehavior: "contain" }}
    >
      {lastModalLocationRef.current && <Routes location={lastModalLocationRef.current}>{children}</Routes>}
    </CenterPopup>
  );

  return { background, modal };
}
