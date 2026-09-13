import type { Metadata } from "next";
import PolicyPage from "../policy-page";
import styles from "../policy.module.css";
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
            <strong>Account information:</strong> Supabase Auth manages
            email/password sign-in and Google OAuth. This includes your email,
            account identifier, authentication/session information, and profile
            details such as your name and avatar supplied during registration or
            by Google. Password authentication is handled by Supabase; Google
            sign-in does not give ClipWeave your Google password.
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
          Account reference images are stored in a{" "}
          <strong>public Supabase Storage bucket</strong>. Anyone with an image
          URL can view or download it without signing in. Account ownership
          controls do not make the image bytes private. Do not upload
          confidential images or images you lack permission to share this way.
          Public copies downloaded by others cannot be recalled by deleting the
          original.
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
        <ul>
          <li>
            <strong>Supabase:</strong> authentication, account/project database,
            and image/video storage.
          </li>
          <li>
            <strong>OpenAI:</strong> our AI planning backend receives story
            text, prompts, and relevant reference data to plan clips and process
            revisions.
          </li>
          <li>
            <strong>RunPod:</strong> GPU rendering receives workflows, prompts,
            and reference data/images to generate videos. Rendering files and
            continuity caches may also be stored on its network volume.
          </li>
          <li>
            <strong>Creem:</strong> processes payments and checkout information.
            ClipWeave receives transaction information needed to credit your
            wallet and reconcile payments. Payment details submitted at checkout
            are handled by Creem under its own privacy policy.
          </li>
        </ul>
        <p>
          OpenAI and RunPod act as service providers/sub-processors for the
          story and reference data required by these features. Processing may
          occur outside your country. Provider policies also govern their
          handling of data. We may disclose information when required by
          applicable law or to address abuse and protect users.
        </p>
        <p>
          Provider information:{" "}
          <a href="https://supabase.com/privacy">Supabase privacy</a>,{" "}
          <a href="https://openai.com/policies/privacy-policy/">
            OpenAI privacy
          </a>
          ,{" "}
          <a href="https://www.runpod.io/legal/privacy-policy">
            RunPod privacy
          </a>
          , and <a href="https://www.creem.io/privacy">Creem privacy</a>.
        </p>
      </section>
      <section>
        <h2>Retention and deletion</h2>
        <p className={styles.placeholder}>
          [PLACEHOLDER: Specify retention periods and deletion practices for
          accounts, projects, reference images, generated videos, render caches,
          logs, backups, support messages, and payment records.]
        </p>
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
