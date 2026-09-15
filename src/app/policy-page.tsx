import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function PolicyPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f3e8] font-sans text-[#172019]">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 border-b border-[#d8dfcf] px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-2xl font-bold text-[#294f3b]">
          <Image src="/brand/clipweave-mark.png" alt="" width={28} height={28} />
          ClipWeave
        </Link>
        <Link href="/">Back to home</Link>
      </header>
      <main className="mx-auto max-w-[780px] break-words px-6 py-14 leading-loose [&_a]:text-[#294f3b] [&_a]:underline [&_a]:underline-offset-4 [&_h1]:my-4 [&_h1]:mb-7 [&_h1]:text-[clamp(2rem,6vw,3.25rem)] [&_h1]:leading-[1.15] [&_h1]:tracking-[-1.5px] [&_h2]:mb-3 [&_h2]:mt-9 [&_h2]:text-[23px] [&_h2]:leading-[1.35] [&_p]:my-3 [&_ul]:my-3 [&_ul]:pl-6">
        <p className="font-mono text-xs text-[#476149]">
          ClipWeave policies · Updated 13 September 2026
        </p>
        <h1>{title}</h1>
        <aside className="rounded border-l-[3px] border-[#476149] bg-[#e6ebda] px-5 py-4">
          ClipWeave is operated by DTECH SOFTWARE LAB ENTERPRISE, a Nigerian
          sole proprietorship registered under BN 9517824.
        </aside>
        {children}
        <section>
          <h2>Contact and operator details</h2>
          <p>
            For support, privacy requests, or abuse reports, email{" "}
            <a href="mailto:support@clipweave.xyz">support@clipweave.xyz</a>.
          </p>
          <p>
            ClipWeave is a product operated by DTECH SOFTWARE LAB ENTERPRISE,
            a Nigerian sole proprietorship registered on 3 May 2026 under
            Business Name Registration No. 9517824.
          </p>
          <p>
            <strong>Principal place of business:</strong> Idialu Street, off
            Ukuhn Road, Eguare, Ekpoma, Edo State, Nigeria.
          </p>
          <p>
            <strong>Registered business email:</strong>{" "}
            <a href="mailto:oseremendestiny77@gmail.com">
              oseremendestiny77@gmail.com
            </a>
            .
          </p>
        </section>
      </main>
      <footer className="mx-auto max-w-7xl border-t border-[#d8dfcf] px-6 py-6">
        <nav className="flex flex-wrap gap-x-7 gap-y-3 [&_a]:text-[#294f3b] [&_a]:underline [&_a]:underline-offset-4" aria-label="Policies">
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/terms">Terms of Service</Link>
          <Link href="/acceptable-use">Acceptable Use Policy</Link>
        </nav>
      </footer>
    </div>
  );
}
