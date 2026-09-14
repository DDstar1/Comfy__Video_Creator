import type { Metadata } from "next";
import localFont from "next/font/local";
import "./studio.css";

// Use the font assets already bundled with our pinned Next.js version so builds
// and local previews do not depend on Google Fonts network availability.
const geistSans = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClipWeave — Turn your story into a cinematic video",
  description:
    "Create three-minute cinematic story videos from ₦1,500. Join the Nigerian early-access launch for ClipWeave.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
