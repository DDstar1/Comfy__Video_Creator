import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./policy.module.css";

export default function PolicyPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          ClipWeave
        </Link>
        <Link href="/">Back to home</Link>
      </header>
      <main className={styles.content}>
        <p className={styles.eyebrow}>
          ClipWeave policies · Updated 13 September 2026
        </p>
        <h1>{title}</h1>
        <aside className={styles.notice}>
          Owner review required: clearly marked placeholders below must be
          completed before these policies are treated as final.
        </aside>
        {children}
        <section>
          <h2>Contact and operator details</h2>
          <p>
            For support, privacy requests, or abuse reports, email{" "}
            <a href="mailto:support@clipweave.xyz">support@clipweave.xyz</a>.
          </p>
          <p className={styles.placeholder}>
            [PLACEHOLDER: Company legal name and registered address, if
            operating as a registered entity.]
          </p>
        </section>
      </main>
      <footer className={styles.footer}>
        <nav aria-label="Policies">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/acceptable-use">Acceptable Use Policy</Link>
        </nav>
      </footer>
    </div>
  );
}
