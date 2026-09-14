import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "../policy-page";
export const metadata: Metadata = {
  title: "Terms of Service | ClipWeave",
  description: "Terms for using ClipWeave's AI video creation service.",
};
export default function TermsPage() {
  return (
    <PolicyPage title="Terms of Service">
      <p>
        These terms govern your use of ClipWeave, a service for turning stories
        and ideas into AI-generated video clips. By using the service, you agree
        to these terms and the{" "}
        <Link href="/acceptable-use">Acceptable Use Policy</Link>. Our{" "}
        <Link href="/privacy">Privacy Policy</Link> explains how information is
        handled.
      </p>
      <section>
        <h2>Your account</h2>
        <p>
          Provide accurate account information, protect your sign-in
          credentials, and contact us if you suspect unauthorized use. You must
          have legal capacity to enter this agreement and authority to act for
          any organization you represent. You are responsible for activity you
          authorize through your account.
        </p>
      </section>
      <section>
        <h2>The service and generated content</h2>
        <p>
          ClipWeave helps you plan scenes, use reference images, generate clips,
          review results, and combine approved clips. AI outputs can contain
          errors, inconsistencies, or unwanted details. Review them before
          validation, publication, or reliance. Validated clips and their
          approved inputs are locked in the editing workflow.
        </p>
        <p>
          We do not guarantee a particular artistic result, likeness, accuracy,
          exclusivity, or uninterrupted availability. Generated content may
          resemble other content, and availability of intellectual property
          protection depends on applicable law.
        </p>
      </section>
      <section>
        <h2>Your content and permissions</h2>
        <p>
          You retain any rights you hold in your uploads. You grant ClipWeave
          permission to store, process, and transmit your content to its service
          providers as needed to provide the features you request. You must have
          the necessary copyright, likeness, and other permissions for your
          inputs and intended use of outputs. Uploading a fictional character
          does not remove the need for intellectual property permission.
        </p>
        <p>
          Real-person references require consent, including consent for
          AI-generated depictions and the public reference-image storage
          described in our Privacy Policy. You must not use the service to
          impersonate, defame, or deceive.
        </p>
      </section>
      <section>
        <h2>Credits, payments, and refunds</h2>
        <p>
          ClipWeave uses prepaid credits for video generation. Review the price
          and credit information shown before purchase or generation. Creem
          processes payments. Credits are used for platform services and are not
          represented as a bank deposit or investment.
        </p>
        <p className="rounded border-l-[3px] border-[#476149] bg-[#e6ebda] px-5 py-4">
          [PLACEHOLDER: Specify refund eligibility, request deadlines and
          process, treatment of unused credits, failed or cancelled generations,
          and account termination balances, subject to mandatory consumer
          rights.]
        </p>
      </section>
      <section>
        <h2>Acceptable use and enforcement</h2>
        <p>
          You must follow our{" "}
          <Link href="/acceptable-use">Acceptable Use Policy</Link>, applicable
          laws, and others&apos; rights. We may investigate reported misuse,
          restrict content, or suspend or terminate access for violations,
          fraud, security threats, or legal requirements. Contact support if you
          believe an action was mistaken or wish to close your account. Data
          retention and any refund treatment are addressed separately in the
          policies above.
        </p>
      </section>
      <section>
        <h2>Availability and changes</h2>
        <p>
          Maintenance, provider outages, capacity limits, and technical failures
          may interrupt service. Features and pricing may change; review the
          terms and price displayed for future purchases. We may update these
          terms by publishing a revised version with an updated date and provide
          additional notice where required by law.
        </p>
      </section>
      <section>
        <h2>Liability</h2>
        <p>
          To the extent permitted by applicable law, the service is provided as
          available without warranties of fitness for a particular purpose, and
          ClipWeave is not responsible for indirect or consequential losses from
          use of the service. Nothing in these terms excludes liability or
          consumer rights that cannot lawfully be excluded. You remain
          responsible for reviewing outputs and how you publish or use them.
        </p>
      </section>
      <section>
        <h2>Governing law and disputes</h2>
        <p className="rounded border-l-[3px] border-[#476149] bg-[#e6ebda] px-5 py-4">
          [PLACEHOLDER: Specify governing law, jurisdiction, and any
          dispute-resolution process, preserving mandatory consumer rights.]
        </p>
        <p>
          Please contact support first so we can try to resolve service
          concerns.
        </p>
      </section>
    </PolicyPage>
  );
}
