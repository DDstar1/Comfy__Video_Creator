"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import LandingAuthButton from "./landing-auth-button";
import styles from "@/app/landing.module.css";

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      <Link href="/" className={styles.brand} aria-label="ClipWeave home">
        <Image className={styles.brandMark} src="/brand/clipweave-mark.png" alt="" width={34} height={34} priority />
        Clip<span>Weave</span>
      </Link>

      <div className={styles.navActions}>
        <a href="#how-it-works">How it works</a>
        <a href="#waitlist">Join waitlist</a>
        <LandingAuthButton mode="signin" hideWhenSignedIn className={styles.navSignIn}>Sign in</LandingAuthButton>
        <LandingAuthButton className={styles.navCta}>Create account</LandingAuthButton>
      </div>

      <button
        type="button"
        className={styles.menuButton}
        aria-label={open ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} /> : <Menu size={22} />}
      </button>

      {open && (
        <div className={styles.mobileMenu} id="landing-mobile-menu">
          <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
          <a href="#waitlist" onClick={() => setOpen(false)}>Join the waitlist</a>
          <LandingAuthButton mode="signin" hideWhenSignedIn className={styles.mobileSignIn}>Sign in</LandingAuthButton>
          <LandingAuthButton className={styles.mobileCreate}>Create account</LandingAuthButton>
        </div>
      )}
    </nav>
  );
}
