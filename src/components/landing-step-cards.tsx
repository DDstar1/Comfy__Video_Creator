"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  BookOpenText,
  Clapperboard,
  ImagePlus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import styles from "@/app/landing.module.css";

const steps = [
  [BookOpenText, "Bring your story", "Paste a scene, a script, or the simple idea you have in your head."],
  [ImagePlus, "Add your references", "Upload characters, places and objects once, then mention them by name."],
  [Sparkles, "Director shapes the clips", "ClipWeave Director turns your words into clear, actionable clips and handles the technical prompts."],
  [Clapperboard, "Approve and receive", "Review each clip, then receive your approved story as one merged cinematic video."],
] as const;

type StepCardProps = {
  Icon: LucideIcon;
  title: string;
  copy: string;
  index: number;
  range: [number, number];
  targetScale: number;
  progress: MotionValue<number>;
  reduceMotion: boolean | null;
};

function StepCard({ Icon, title, copy, index, range, targetScale, progress, reduceMotion }: StepCardProps) {
  const scale = useTransform(progress, range, [1, targetScale]);
  const entranceStart = Math.max(0, index * 0.25 - 0.16);
  const entranceEnd = Math.max(0.12, index * 0.25 + 0.04);
  const y = useTransform(progress, [entranceStart, entranceEnd], [56, 0]);
  const opacity = useTransform(progress, [entranceStart, entranceEnd], [0, 1]);

  return (
    <div
      className={styles.stepCardContainer}
      style={{ "--card-index": index } as CSSProperties}
    >
      <motion.article
        className={styles.stepCard}
        style={{
          scale: reduceMotion ? 1 : scale,
          y: reduceMotion ? 0 : y,
          opacity: reduceMotion ? 1 : opacity,
        }}
      >
        <div className={styles.stepTop}>
          <Icon size={23} />
          <span>0{index + 1}</span>
        </div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </motion.article>
    </div>
  );
}

export default function LandingStepCards() {
  const section = useRef<HTMLDivElement>(null);
  const [headingClearance, setHeadingClearance] = useState<number>();
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start center", "end end"],
  });
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const heading = document.querySelector<HTMLElement>("[data-process-heading]");
    if (!heading) return;

    const updateClearance = () => {
      setHeadingClearance(Math.ceil(heading.getBoundingClientRect().height) + 20);
    };

    updateClearance();
    const observer = new ResizeObserver(updateClearance);
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={styles.stepGrid}
      ref={section}
      style={
        headingClearance
          ? ({ "--step-heading-clearance": `${headingClearance}px` } as CSSProperties)
          : undefined
      }
    >
      {steps.map(([Icon, title, copy], index) => (
        <StepCard
          key={title}
          Icon={Icon}
          title={title}
          copy={copy}
          index={index}
          range={[index * 0.25, 1]}
          targetScale={1 - (steps.length - index) * 0.05}
          progress={scrollYProgress}
          reduceMotion={reduceMotion}
        />
      ))}
    </div>
  );
}
