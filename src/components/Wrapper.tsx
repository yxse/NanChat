import type { ReactNode } from "react";

export default function PopupWrapper({
  children,
  theme,
}: {
  children: ReactNode;
  theme: "light" | "dark";
}) {
  return (
    <div
      >{children}</div>
  );
}
