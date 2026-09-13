import {
  ArrowRight,
  BookOpenText,
  Check,
  Clapperboard,
  Globe2,
  ImagePlus,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import Waitlist from "@/components/waitlist";
import LandingAuthButton from "@/components/landing-auth-button";
import LandingNav from "@/components/landing-nav";
import styles from "./landing.module.css";
import Link from "next/link";

const steps = [
  [
    BookOpenText,
    "Bring your story",
    "Paste a scene from your book or describe the video in your head.",
  ],
  [
    ImagePlus,
    "Add your references",
    "Upload characters, places and objects once, then mention them by name.",
  ],
  [
    Sparkles,
    "Shape every clip",
    "Review simple descriptions while ClipWeave prepares the technical video workflow.",
  ],
  [
    Clapperboard,
    "Approve and continue",
    "Verify each clip before the next one begins, so the story carries forward smoothly.",
  ],
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <LandingNav />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span /> Built for Nigerian storytellers
          </p>
          <h1>
            Turn your story into a <em>3-minute cinematic video.</em>
          </h1>
          <p className={styles.lede}>
            Bring a book scene, script or simple idea. ClipWeave helps you plan
            every shot, keep your characters consistent and generate the
            finished story.
          </p>
          <div className={styles.heroOffer}>
            <div>
              <small>Launch pricing from</small>
              <strong>₦1,500</strong>
            </div>
            <span>Launching 17 September 2026</span>
          </div>
          <div className={styles.heroActions}>
            <LandingAuthButton className={styles.primary}>
              Create free account <ArrowRight size={18} />
            </LandingAuthButton>
            <a href="#how-it-works" className={styles.secondary}>
              See how it works
            </a>
          </div>
          <p className={styles.fine}>
            <Check size={15} /> Create your account now, then join the launch
            list below for early-access benefits.
          </p>
        </div>

        <div
          className={styles.heroVisual}
          aria-label="An illustrated ClipWeave clip sequence"
        >
          <div className={styles.filmFrame}>
            <div className={styles.sceneGlow} />
            <span className={styles.frameNumber}>01</span>
            <div className={styles.sceneText}>
              <small>YOUR STORY</small>
              <strong>
                A quiet street.
                <br />
                One impossible light.
              </strong>
            </div>
          </div>
          <div className={styles.timeline}>
            {["Scene", "References", "Clips", "Video"].map((item, index) => (
              <div key={item} className={index === 2 ? styles.activeStep : ""}>
                <span>{index + 1}</span>
                {item}
              </div>
            ))}
          </div>
          <div className={styles.promptCard}>
            <Sparkles size={17} />
            <div>
              <small>CLIPWEAVE DIRECTOR</small>
              <p>
                “Keep Ada’s face and red headwrap consistent as the camera
                moves…”
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofStrip} aria-label="Product benefits">
        <span>
          <LockKeyhole size={17} /> Verify every clip before moving on
        </span>
        <span>
          <ImagePlus size={17} /> Reuse reference images
        </span>
        <span>
          <Globe2 size={17} /> Nigeria first, built for the world
        </span>
      </section>

      <section className={styles.how} id="how-it-works">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>
            <span /> From words to motion
          </p>
          <h2>
            Your story stays yours.
            <br />
            The complicated workflow disappears.
          </h2>
        </div>
        <div className={styles.stepGrid}>
          {steps.map(([Icon, title, copy], index) => (
            <article key={title}>
              <div className={styles.stepTop}>
                <Icon size={23} />
                <span>0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.feature}>
        <div className={styles.referenceWall}>
          <div
            className={`${styles.referencePhoto} ${styles.refOne}`}
            role="img"
            aria-label="Ada character reference"
          >
            <span>
              <small>Character</small>@Ada
            </span>
          </div>
          <div
            className={`${styles.referencePhoto} ${styles.refTwo}`}
            role="img"
            aria-label="Lagos at night location reference"
          >
            <span>
              <small>Location</small>@LagosNight
            </span>
          </div>
          <div
            className={`${styles.referencePhoto} ${styles.refThree}`}
            role="img"
            aria-label="Blue vintage car reference"
          >
            <span>
              <small>Object</small>@BlueCar
            </span>
          </div>
          <div className={styles.referenceFlow} aria-hidden="true">
            <ArrowRight size={17} />
          </div>
          <div
            className={`${styles.referencePhoto} ${styles.refResult}`}
            role="img"
            aria-label="Cinematic result showing Ada with the blue car in Lagos at night"
          >
            <span>
              <small>Generated frame</small>Cinematic result
            </span>
          </div>
        </div>
        <div className={styles.featureCopy}>
          <p className={styles.eyebrow}>
            <span /> Visual continuity
          </p>
          <h2>
            Upload once.
            <br />
            Keep every detail familiar.
          </h2>
          <p>
            Your account keeps a reusable image library. Add references to a
            project and mention <code>@Ada</code> or <code>@LagosNight</code>{" "}
            naturally inside your scene.
          </p>
          <div className={styles.continuityPromise}>
            <strong>No sudden skips. No unexplained changes.</strong>
            <span>
              You verify each clip before ClipWeave creates the next, giving
              every scene a clear visual starting point.
            </span>
          </div>
          <ul>
            <li>
              <Check size={16} /> Characters remain recognisable between clips
            </li>
            <li>
              <Check size={16} /> Locations and important objects stay
              consistent
            </li>
            <li>
              <Check size={16} /> Each approved ending guides the next clip—no
              sudden jumps
            </li>
            <li>
              <Check size={16} /> Your approved clips cannot be accidentally
              rewritten
            </li>
          </ul>
        </div>
      </section>

      <section className={styles.waitlistSection} id="waitlist">
        <div className={styles.waitlistIntro}>
          <p className={styles.eyebrow}>
            <span /> Private early access
          </p>
          <h2>Be there when the first story begins.</h2>
          <p>
            Join the launch list for early access on 17 September. Your email
            appears publicly only in a masked form, so you can see your real
            position without exposing your address.
          </p>
          <div className={styles.discount}>
            <strong>20% off</strong>
            <span>for the first 10 customers</span>
          </div>
        </div>
        <Waitlist />
      </section>

      <footer className={styles.footer}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>C</span>Clip<span>Weave</span>
        </div>
        <div className={styles.footerCopy}>
          <p>Stories deserve to move.</p>
          <small>
            ClipWeave is a product operated by DTECH SOFTWARE LAB ENTERPRISE,
            a business registered in Nigeria.
          </small>
        </div>
        <nav className={styles.policyLinks} aria-label="Policies">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/acceptable-use">Acceptable Use Policy</Link>
        </nav>
        <LandingAuthButton mode="signin">
          Creator sign in <ArrowRight size={15} />
        </LandingAuthButton>
      </footer>
    </main>
  );
}
