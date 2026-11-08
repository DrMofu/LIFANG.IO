"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

function subscribePageVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

const isPageVisible = () => document.visibilityState === "visible";
const serverPageVisible = () => true;

export function useTutorialVisibility(targetRef: RefObject<HTMLElement | null>) {
  const [visibility, setVisibility] = useState({ visible: false, entered: false });
  const pageVisible = useSyncExternalStore(subscribePageVisibility, isPageVisible, serverPageVisible);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    function update(visible: boolean) {
      setVisibility((current) => current.visible === visible && (current.entered || !visible)
        ? current
        : { visible, entered: current.entered || visible });
    }

    if (typeof IntersectionObserver === "undefined") {
      const timer = window.setTimeout(() => update(true), 0);
      return () => window.clearTimeout(timer);
    }

    const preloadObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisibility((current) => current.entered ? current : { ...current, entered: true });
      preloadObserver.disconnect();
    }, {
      root: target.closest(".tutorial-scroll"),
      rootMargin: "300px 0px",
    });
    const observer = new IntersectionObserver(([entry]) => update(entry.isIntersecting));
    preloadObserver.observe(target);
    observer.observe(target);
    return () => {
      preloadObserver.disconnect();
      observer.disconnect();
    };
  }, [targetRef]);

  return { shouldMount: visibility.entered, active: visibility.visible && pageVisible };
}
