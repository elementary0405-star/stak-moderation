"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { DiscordSessionUser } from "@/lib/auth";
import { hasPortalAccess, isStaffRole } from "@/lib/portal-access";
import styles from "./PortalOnboarding.module.css";

type TourStep = { title: string; body: string; target?: string };
type OnboardingState = { status: "completed" | "skipped" | null };
type Box = { top: number; left: number; width: number; height: number };

function getSteps(user: DiscordSessionUser): TourStep[] {
  if (!isStaffRole(user.stakRole)) {
    return [
      { title: "Welcome to the Community Area", body: "This area is the entry point for STAK staff recruitment. Your access is verified through your Discord account." },
      { title: "Read Staff Guidelines", body: "Read the staff guidelines before applying. They explain the expectations and requirements for joining the STAK team.", target: "community-guidelines" },
      { title: "Start your application", body: "Once you have reviewed and acknowledged the guidelines, you can start your application here when recruitment is open.", target: "community-application" },
      { title: "Return or sign out safely", body: "Use Replay Introduction in the header to see this tour again. Sign Out ends your protected session.", target: "portal-sign-out" },
    ];
  }

  const steps: TourStep[] = [
    { title: "Welcome to the Staff Area", body: "Only the areas available to your currently verified Discord role are shown here. Use the resources and Academy assigned to your role." },
    { title: "Staff Hub", body: "Open your staff workspace for your own record and the team tools available to your role.", target: "staff-hub" },
  ];
  if (hasPortalAccess(user.stakRole, "trailModerator")) {
    steps.push({ title: "Cases & Records", body: "Use this area for player records, case history, sanctions and evidence within your assigned permissions.", target: "staff-records" });
  }
  steps.push({ title: "Staff Resources", body: "Read the internal Staff Handbook and the practical Ticket Guide here. They are available to staff only.", target: "staff-resources" });
  if (hasPortalAccess(user.stakRole, "trailModerator")) {
    steps.push({ title: "Staff Academy", body: "Continue assigned training here. General Staff Training must be completed and approved before ticket handling is permitted.", target: "staff-academy" });
  }
  if (hasPortalAccess(user.stakRole, "staffManager")) {
    steps.push({ title: "Management tools", body: "Your Staff Hub shows the management tools available to your role. Actions remain limited to the permissions shown for your account.", target: "staff-hub" });
  }
  steps.push({ title: "Return or sign out safely", body: "Use Replay Introduction in the header to see this tour again. Sign Out ends your protected session.", target: "portal-sign-out" });
  return steps;
}

export default function PortalOnboarding({ user }: { user: DiscordSessionUser }) {
  const area = isStaffRole(user.stakRole) ? "staff" : "community";
  const homePath = area === "staff" ? "/staff-area" : "/community-area";
  const steps = useMemo(() => getSteps(user), [user]);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState({ top: 20, left: 20 });
  const [bubbleHeight, setBubbleHeight] = useState(220);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const bubbleRef = useRef<HTMLElement | null>(null);
  const currentStep = steps[stepIndex];

  useEffect(() => {
    if (window.location.pathname !== homePath) return;
    const url = new URL(window.location.href);
    const replay = url.searchParams.get("intro") === "1";
    if (replay) {
      url.searchParams.delete("intro");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

    let active = true;
    fetch(`/api/onboarding?area=${area}`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("progress unavailable");
        return await response.json() as OnboardingState;
      })
      .then((progress) => {
        if (!active) return;
        if (replay || progress.status === null) {
          setStepIndex(0);
          setOpen(true);
        }
      })
      .catch(() => {
        if (active && replay) {
          setPersistenceError("Introduction progress could not be loaded. You can still review this tour.");
          setOpen(true);
        }
      })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [area, homePath]);

  useEffect(() => {
    if (!open || !currentStep) return;
    let raf = 0;
    const update = () => {
      const selector = currentStep.target ? `[data-tour="${currentStep.target}"]` : null;
      const element = selector ? document.querySelector<HTMLElement>(selector) : null;
      if (element) element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
      raf = window.requestAnimationFrame(() => {
        const bubble = bubbleRef.current;
        if (!bubble) return;
        const bubbleRect = bubble.getBoundingClientRect();
        const width = bubbleRect.width;
        const height = bubbleRect.height;
        setBubbleHeight(height);
        const margin = 16;
        const anchor = element?.getBoundingClientRect() ?? null;
        if (!anchor) {
          setTargetBox(null);
          setPosition({
            left: Math.max(margin, (window.innerWidth - width) / 2),
            top: Math.max(margin, (window.innerHeight - height) / 2),
          });
          return;
        }

        const candidates = [
          { left: anchor.left + (anchor.width - width) / 2, top: anchor.bottom + 16 },
          { left: anchor.left + (anchor.width - width) / 2, top: anchor.top - height - 16 },
          { left: anchor.right + 16, top: anchor.top + (anchor.height - height) / 2 },
          { left: anchor.left - width - 16, top: anchor.top + (anchor.height - height) / 2 },
        ];
        const fits = (box: { left: number; top: number }) => box.left >= margin && box.top >= margin
          && box.left + width <= window.innerWidth - margin
          && box.top + height <= window.innerHeight - margin
          && (box.left + width <= anchor.left || box.left >= anchor.right || box.top + height <= anchor.top || box.top >= anchor.bottom);
        const choice = candidates.find(fits) ?? {
          left: Math.max(margin, Math.min(window.innerWidth - width - margin, anchor.left + (anchor.width - width) / 2)),
          top: anchor.top > window.innerHeight / 2
            ? Math.max(margin, anchor.top - height - 16)
            : Math.min(window.innerHeight - height - margin, anchor.bottom + 16),
        };
        setPosition({ left: choice.left, top: choice.top });
        setTargetBox({ top: anchor.top - 5, left: anchor.left - 5, width: anchor.width + 10, height: anchor.height + 10 });
      });
    };
    const timer = window.setTimeout(update, 80);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, currentStep]);

  useEffect(() => {
    if (open) bubbleRef.current?.focus();
  }, [open, stepIndex]);

  if (!ready || !open || !currentStep) return null;

  const targetCenter = targetBox
    ? { x: targetBox.left + targetBox.width / 2, y: targetBox.top + targetBox.height / 2 }
    : null;
  const bubbleWidth = typeof window === "undefined" ? 328 : Math.min(360, window.innerWidth - 32);
  const bubbleCenter = { x: position.left + bubbleWidth / 2, y: position.top + bubbleHeight / 2 };
  const startsAtBottom = Boolean(targetCenter && targetCenter.y > bubbleCenter.y);
  const startsAtRight = Boolean(targetCenter && targetCenter.x > bubbleCenter.x);
  const lineStart = targetCenter ? {
    x: startsAtRight ? position.left + bubbleWidth : position.left,
    y: startsAtBottom ? position.top + bubbleHeight : position.top,
  } : null;

  return (
    <div className={styles.overlay}>
      <div className={styles.scrim} aria-hidden="true" />
      {targetBox ? <div className={styles.spotlight} style={targetBox as CSSProperties} aria-hidden="true" /> : null}
      {targetCenter && lineStart ? (
        <svg className={styles.leader} width="100%" height="100%" aria-hidden="true">
          <line x1={lineStart.x} y1={lineStart.y} x2={targetCenter.x} y2={targetCenter.y} />
          <circle cx={targetCenter.x} cy={targetCenter.y} r="4" />
        </svg>
      ) : null}
      <section
        ref={bubbleRef}
        className={styles.bubble}
        style={{ top: position.top, left: position.left } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
      >
        <span className={styles.stepCount}>{area === "staff" ? "STAFF AREA" : "COMMUNITY AREA"} · {stepIndex + 1} OF {steps.length}</span>
        <h2 id="tour-title">{currentStep.title}</h2>
        <p>{currentStep.body}</p>
        {persistenceError ? <p className={styles.error} role="alert">{persistenceError}</p> : null}
        <div className={styles.controls}>
          <button className={styles.textButton} type="button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))} disabled={stepIndex === 0}>Back</button>
          <button className={styles.textButton} type="button" onClick={() => void closeTour("skipped")}>Skip</button>
          {stepIndex < steps.length - 1 ? (
            <button className={styles.primaryButton} type="button" onClick={() => setStepIndex((current) => Math.min(steps.length - 1, current + 1))}>Next <span aria-hidden="true">→</span></button>
          ) : (
            <button className={styles.primaryButton} type="button" onClick={() => void closeTour("completed")}>Finish</button>
          )}
        </div>
      </section>
    </div>
  );

  async function closeTour(status: "completed" | "skipped") {
    setPersistenceError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ area, status }),
      });
      if (!response.ok) throw new Error("progress could not be saved");
      setOpen(false);
    } catch {
      setPersistenceError("Could not save your progress. Please try again.");
    }
  }
}
