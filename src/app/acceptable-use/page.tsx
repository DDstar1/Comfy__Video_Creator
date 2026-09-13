import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "../policy-page";
export const metadata: Metadata = {
  title: "Acceptable Use Policy | ClipWeave",
  description:
    "Consent and safety rules for reference images and AI-generated characters in ClipWeave.",
};
export default function AcceptableUsePage() {
  return (
    <PolicyPage title="Acceptable Use Policy">
      <p>
        ClipWeave is a creative storytelling service for consent-based character
        animation. It uses reference images to generate new video depicting a
        recognisable person or character. It is not offered for unauthorized
        face swaps, deceptive deepfakes, or impersonation. These rules apply to
        uploads, prompts, generated clips, and how you share them.
      </p>
      <section>
        <h2>Who you may depict</h2>
        <p>
          <strong>
            You may only upload reference images of fictional characters,
            yourself, or people who have given their consent.
          </strong>{" "}
          You must also own or have permission to use the image itself and any
          protected character depicted.
        </p>
        <p>
          Never upload or generate a real person&apos;s likeness without their
          consent. A photo being online, publicly available, or showing a
          celebrity does not establish consent. Permission to take a photograph
          is not automatically permission to animate that person with AI.
        </p>
        <p>
          Consent must cover the intended AI-generated depiction and use,
          including public storage of reference images. Respect its scope and
          keep evidence of permission. Do not continue using a likeness after
          consent is withdrawn; contact support about existing material. For a
          minor, obtain permission from their parent or legal guardian and
          respect the child&apos;s safety and applicable law.
        </p>
      </section>
      <section>
        <h2>No impersonation, defamation, or deception</h2>
        <ul>
          <li>
            Do not impersonate another person, create false endorsements, or
            misrepresent their identity, statements, actions, or affiliation.
          </li>
          <li>
            Do not create defamatory depictions, fabricated evidence, scams,
            identity fraud, or misleading political or commercial content.
          </li>
          <li>
            Do not present AI-generated scenes as authentic recordings of
            events. Clearly disclose that content is AI-generated when viewers
            could reasonably mistake it for real footage.
          </li>
        </ul>
        <p>
          These prohibitions apply even when you have permission to use the
          underlying photo. Consent does not authorize harmful or deceptive
          uses.
        </p>
      </section>
      <section>
        <h2>Other prohibited content and conduct</h2>
        <ul>
          <li>
            Sexual exploitation of minors, sexualized depictions of minors, and
            non-consensual intimate imagery or sexual depictions.
          </li>
          <li>
            Harassment, threats, hateful abuse, doxxing, or content intended to
            exploit or endanger people.
          </li>
          <li>
            Violations of copyright, privacy, publicity, or other rights, or
            content that facilitates unlawful activity.
          </li>
          <li>
            Attempts to bypass access controls, access another user&apos;s data,
            abuse payment systems, distribute malicious code, or disrupt the
            service.
          </li>
        </ul>
      </section>
      <section>
        <h2>Review before sharing</h2>
        <p>
          Review every generated clip for unwanted likenesses, misleading
          details, or other harmful output before approving or publishing it. A
          successful generation or validation is not verification of consent or
          legal clearance. You are responsible for your inputs and use of
          outputs.
        </p>
      </section>
      <section>
        <h2>Reports and enforcement</h2>
        <p>
          Report suspected misuse or unauthorized use of your likeness to{" "}
          <a href="mailto:support@clipweave.xyz">support@clipweave.xyz</a>.
          Include the relevant URL or project details, a description of the
          concern, and how we can contact you. Do not email passwords or
          unnecessary sensitive documents.
        </p>
        <p>
          We may investigate reports, request evidence of consent or rights,
          restrict or remove content, and suspend or terminate accounts for
          violations. Contact support to ask for review of an enforcement
          decision. We do not claim that every upload is reviewed or that
          automated checks verify consent.
        </p>
        <p>
          Read our <Link href="/privacy">Privacy Policy</Link> for public
          reference-image storage and our{" "}
          <Link href="/terms">Terms of Service</Link> for account and service
          terms.
        </p>
      </section>
    </PolicyPage>
  );
}
