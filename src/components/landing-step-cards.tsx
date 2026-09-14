"use client";

import { useRef } from "react";
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

  return (
    <motion.article
      className={styles.stepCard}
      style={{
        top: "12vh",
        scale: reduceMotion ? 1 : scale,
      }}
    >
      <div className={styles.stepTop}>
        <Icon size={23} />
        <span>0{index + 1}</span>
      </div>
      <h3>{title}</h3>
      <p>{copy}</p>
    </motion.article>
  );
}

export default function LandingStepCards() {
  const section = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start center", "end end"],
  });
  const reduceMotion = useReducedMotion();

  return (
    <div className={styles.stepGrid} ref={section}>
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
