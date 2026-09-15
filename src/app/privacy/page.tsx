import type { Metadata } from "next";
import PolicyPage from "../policy-page";
export const metadata: Metadata = {
  title: "Privacy Policy | ClipWeave",
  description:
    "How ClipWeave handles account information, reference images, stories, videos, and payments.",
};
export default function PrivacyPage() {
  return (
    <PolicyPage title="Privacy Policy">
      <p>
        This policy explains how ClipWeave handles information when you create
        an account, plan scenes, upload references, generate videos, or purchase
        credits.
      </p>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Account information:</strong> our authentication service
            manages email/password sign-in and Google sign-in. This includes
            your email, account identifier, authentication/session information,
            and profile details such as your name and avatar supplied during
            registration or by Google. Google sign-in does not give ClipWeave
            your Google password.
          </li>
          <li>
            <strong>Creative content:</strong> uploaded reference images and
            their names, project titles, story text, scene descriptions, prompts
            and revisions, reference selections, quality settings, generated
            videos, and validation status.
          </li>
          <li>
            <strong>Service and payment records:</strong> render identifiers,
            job status, errors, usage, wallet balances, and payment/credit
            transaction records used to operate and troubleshoot the service.
          </li>
          <li>
            <strong>Optional communications:</strong> support messages and
            waitlist email addresses. Waitlist registration displays a masked
            email and registration position publicly.
          </li>
        </ul>
      </section>
      <section>
        <h2>How information is used</h2>
        <p>
          We use this information to authenticate accounts, save projects, plan
          and revise prompts, render and deliver videos, process credit
          purchases, maintain balances, respond to support requests, and
          investigate failures or misuse. Authentication uses browser session
          storage mechanisms to keep you signed in.
        </p>
      </section>
      <section>
        <h2>Reference images are publicly accessible</h2>
        <p>
          Account reference images are stored in <strong>publicly accessible
          storage</strong>. Anyone with an image URL can view or download it
          without signing in. Account ownership controls do not make the image
          bytes private. Do not upload confidential images or images you lack
          permission to share this way. Public copies downloaded by others
          cannot be recalled by deleting the original.
        </p>
        <p>
          Generated videos and merged exports are stored in a private bucket.
          Playback and downloads use time-limited signed URLs; anyone holding a
          valid signed URL can access that file until the URL expires. Keep
          these links private.
        </p>
      </section>
      <section>
        <h2>Service providers and data sharing</h2>
        <p>
          We use carefully selected service providers to operate ClipWeave. They
          process information only as needed to provide the service, protect it,
          and comply with applicable obligations.
        </p>
        <ul>
          <li>
            <strong>Account, cloud, and storage providers:</strong> authenticate
            users and store account, project, reference-image, and video data.
          </li>
          <li>
            <strong>AI and rendering providers:</strong> process the story text,
            prompts, and reference data needed to plan and generate the videos
            you request.
          </li>
          <li>
            <strong>Payment providers:</strong> process checkout payments and
            provide transaction information needed to add credits and reconcile
            purchases. Payment details are handled under the payment provider’s
            own privacy policy.
          </li>
        </ul>
        <p>
          These providers may process information outside your country. We may
          also disclose information where required by law or to investigate
          misuse and protect users, our service, and the public.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p>
          We keep account information, projects, reference images, and generated
          videos while your account remains active, unless we no longer need the
          information to provide ClipWeave. When you delete content or close an
          account, we aim to remove the active copy from our systems within 30
          days, subject to the exceptions below.
        </p>
        <ul>
          <li>
            <strong>Rendering caches and temporary files:</strong> we retain
            motion-context caches and temporary rendering files for up to 30
            days of inactivity. Regenerating a clip removes dependent cache
            segments and videos that are no longer part of the active sequence.
          </li>
          <li>
            <strong>Backups:</strong> deleted data may remain in backup copies
            for up to 90 days before those copies are overwritten or expire.
          </li>
          <li>
            <strong>Service logs:</strong> we retain routine operational and
            security logs for up to 90 days.
          </li>
          <li>
            <strong>Support messages:</strong> we retain support requests for
            up to 12 months after the request is resolved.
          </li>
          <li>
            <strong>Payment and transaction records:</strong> we retain these
            records for up to seven years where needed for accounting, tax,
            fraud prevention, dispute handling, or legal obligations.
          </li>
        </ul>
        <p>
          Contact support to request access, correction, or deletion of your
          information. We may need to verify account ownership. Available rights
          and any legal retention requirements depend on applicable law.
          Removing a reference from one project does not necessarily delete it
          from your account library or rendering caches.
        </p>
      </section>
      <section>
        <h2>Security and policy updates</h2>
        <p>
          We use account access controls and private storage for generated
          videos, but no service can guarantee absolute security. Reference
          images are intentionally public as explained above. We may update this
          policy as the service changes and will publish the revised version and
          update date here.
        </p>
      </section>
    </PolicyPage>
  );
}
