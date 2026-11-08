"use client";

import { useEffect } from "react";

export function ButtonFocusManager() {
  useEffect(() => {
    const releasePointerFocus = (event: MouseEvent) => {
      // Keyboard and assistive-technology activation must keep their focus.
      if (event.detail === 0 || !(event.target instanceof Element)) return;
      const button = event.target.closest("button");
      if (!button) return;

      // Let click handlers finish, preserving any focus moved into a menu/dialog.
      window.setTimeout(() => {
        // Open menus rely on their trigger's focus to stay open until dismissed.
        if (button.getAttribute("aria-expanded") === "true") return;
        if (document.activeElement === button) button.blur();
      }, 0);
    };

    document.addEventListener("click", releasePointerFocus, true);
    return () => document.removeEventListener("click", releasePointerFocus, true);
  }, []);

  return null;
}
