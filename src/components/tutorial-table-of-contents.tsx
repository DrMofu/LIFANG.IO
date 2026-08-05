"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { TutorialHeading } from "@/lib/tutorial-headings";

export function TutorialTableOfContents({
  headings,
  label,
}: {
  headings: TutorialHeading[];
  label: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  const alignmentTimerRef = useRef<number | undefined>(undefined);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  const handleSectionClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    const scrollRoot = navRef.current?.closest<HTMLElement>(".tutorial-scroll");
    const target = document.getElementById(id);
    if (!scrollRoot || !target) return;

    event.preventDefault();
    window.history.pushState(null, "", `#${id}`);
    setActiveId(id);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alignTarget = (behavior: ScrollBehavior) => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      const targetTop = target.getBoundingClientRect().top;
      scrollRoot.scrollTo({
        top: scrollRoot.scrollTop + targetTop - rootTop - 24,
        behavior,
      });
    };

    resizeObserverRef.current?.disconnect();
    const article = scrollRoot.querySelector<HTMLElement>(".tutorial-article");
    if (article) {
      resizeObserverRef.current = new ResizeObserver(() => alignTarget("auto"));
      resizeObserverRef.current.observe(article);
    }

    alignTarget(reducedMotion ? "auto" : "smooth");
    window.clearTimeout(alignmentTimerRef.current);
    alignmentTimerRef.current = window.setTimeout(() => {
      resizeObserverRef.current?.disconnect();
      alignTarget("auto");
    }, 1400);
  };

  useEffect(() => {
    const scrollRoot = navRef.current?.closest<HTMLElement>(".tutorial-scroll");
    if (!scrollRoot || headings.length === 0) return;

    const sections = headings
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) return;

    let frame = 0;
    const updateActiveSection = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rootTop = scrollRoot.getBoundingClientRect().top;
        const activationLine = rootTop + Math.min(160, scrollRoot.clientHeight * 0.24);
        let nextActiveId = sections[0].id;

        for (const section of sections) {
          if (section.getBoundingClientRect().top > activationLine) break;
          nextActiveId = section.id;
        }

        if (scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2) {
          nextActiveId = sections.at(-1)?.id ?? nextActiveId;
        }

        setActiveId((currentId) => currentId === nextActiveId ? currentId : nextActiveId);
      });
    };

    updateActiveSection();
    scrollRoot.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(alignmentTimerRef.current);
      resizeObserverRef.current?.disconnect();
      scrollRoot.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [headings]);

  return (
    <nav ref={navRef} className="tutorial-toc" aria-label={label}>
      <div className="tutorial-toc-title">{label}</div>
      <ol>
        {headings.map(({ id, title }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={activeId === id ? "is-active" : undefined}
              aria-current={activeId === id ? "location" : undefined}
              onClick={(event) => handleSectionClick(event, id)}
            >
              {title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
