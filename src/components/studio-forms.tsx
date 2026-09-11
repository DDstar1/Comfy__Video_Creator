"use client";

import { useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Eye,
  EyeOff,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Upload,
  WandSparkles,
} from "lucide-react";
import { Modal, Photo } from "./ui";
import {
  signInWithGoogle,
  supabase,
  REFERENCE_BUCKET,
  REFERENCE_TABLE,
} from "@/lib/supabase";
import {
  newProject,
  type Project,
  type ReferenceImage,
} from "@/lib/studio-model";

export function NewProjectForm({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (project: Project) => void;
}) {
  const [kind, setKind] = useState<"scene" | "idea">("scene");
  const [title, setTitle] = useState("");
  const [story, setStory] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  async function readFile(upload?: File) {
    if (!upload) return;
    if (!/\.(txt|md)$/i.test(upload.name) || upload.size > 2 * 1024 * 1024) {
      setError(
        "Choose a TXT or Markdown file smaller than 2 MB. You can also paste a scene from another document.",
      );
      return;
    }
    try {
      const text = await upload.text();
      setStory(text);
      setFileName(upload.name);
      setError("");
    } catch {
      setError("This file could not be read. Try pasting your scene instead.");
    }
  }
  return (
    <Modal
      title="Every film starts with a story."
      eyebrow="A NEW BEGINNING"
      onClose={onClose}
      wide
    >
      <p className="modal-intro">
        A passage you love. An idea you can’t shake. Start here.
      </p>
      <div className="segmented">
        <button
          className={kind === "scene" ? "active" : ""}
          onClick={() => setKind("scene")}
        >
          <BookOpen size={17} /> Book scene
        </button>
        <button
          className={kind === "idea" ? "active" : ""}
          onClick={() => setKind("idea")}
        >
          <WandSparkles size={17} /> Original idea
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !story.trim()) {
            setError(
              "Add a project name and a little of your story to get started.",
            );
            return;
          }
          onCreate(newProject(title.trim(), story.trim()));
        }}
      >
        <label className="field">
          Project name
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your story a name"
            maxLength={200}
            required
          />
        </label>
        <label className="field">
          {kind === "scene" ? "Your scene" : "What do you want to create?"}
          <textarea
            rows={7}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            placeholder={
              kind === "scene"
                ? "Paste a scene from your book. Describe the place, the people, and what happens…"
                : "A little café on Mars. A rain-soaked city at midnight. Tell us what you imagine…"
            }
            required
          />
        </label>
        {kind === "scene" && (
          <>
            <input
              ref={file}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              hidden
              onChange={(e) => {
                void readFile(e.target.files?.[0]);
              }}
            />
            <button
              type="button"
              className="file-import"
              onClick={() => file.current?.click()}
            >
              <Upload size={16} />
              {fileName || "Or upload a scene"}
              <span>TXT, MD · up to 2 MB</span>
            </button>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <span className="muted small">
            You can shape the details as you go.
          </span>
          <button className="button primary" type="submit">
            Create project <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AuthForm({
  onClose,
  onSuccess,
  defaultMode = "signin",
}: {
  onClose: () => void;
  onSuccess: () => void;
  defaultMode?: "signin" | "signup";
}) {
  const [signup, setSignup] = useState(defaultMode === "signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Account connection is not configured on this deployment.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    if (signup && password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const result = signup
        ? await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) onSuccess();
      else
        setMessage(
          "Check your email to confirm your account, then come back to sign in.",
        );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        signup ? "A home for your imagination." : "Welcome back, storyteller."
      }
      eyebrow="YOUR CLIPWEAVE ACCOUNT"
      onClose={onClose}
    >
      <p className="modal-intro">
        {signup ? "Create an account" : "Sign in"} to upload images and keep a
        reference library you can use across projects. Projects are saved
        securely to your account.
      </p>
      <div className="segmented auth-tabs" aria-label="Account action">
        <button
          type="button"
          className={!signup ? "active" : ""}
          onClick={() => setSignup(false)}
        >
          Sign in
        </button>
        <button
          type="button"
          className={signup ? "active" : ""}
          onClick={() => setSignup(true)}
        >
          Create account
        </button>
      </div>
      <button
        type="button"
        className="google-auth-button"
        onClick={() => {
          setBusy(true);
          setError("");
          void signInWithGoogle().catch((err: unknown) => {
            setError(
              err instanceof Error
                ? err.message
                : "Google sign-in could not start.",
            );
            setBusy(false);
          });
        }}
        disabled={busy}
      >
        <span aria-hidden="true">G</span> Continue with Google
      </button>
      <div className="auth-divider">
        <span>or use email</span>
      </div>
      <form onSubmit={submit}>
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
            />
          </label>
        )}
        <label className="field">
          <span>
            <Mail size={14} /> Email address
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label className="field">
          <span>
            <LockKeyhole size={14} /> Password
          </span>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        {signup && (
          <label className="field">
            <span>
              <LockKeyhole size={14} /> Confirm password
            </span>
            <div className="password-field">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={
                  showConfirm
                    ? "Hide password confirmation"
                    : "Show password confirmation"
                }
                onClick={() => setShowConfirm((value) => !value)}
              >
                {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="form-success" role="status">
            {message}
          </p>
        )}
        <button
          className="button primary full-width"
          disabled={busy}
          type="submit"
        >
          {busy ? <LoaderCircle className="spin" size={17} /> : null}
          {signup ? "Create account" : "Sign in"}
          <ArrowRight size={16} />
        </button>
      </form>
      <button
        className="text-button auth-switch"
        onClick={() => {
          setSignup(!signup);
          setError("");
          setMessage("");
          setConfirmPassword("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </Modal>
  );
}

export function UploadForm({
  userId,
  onClose,
  onUploaded,
}: {
  userId: string;
  onClose: () => void;
  onUploaded: (image: ReferenceImage) => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function choose(next?: File) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (next.size > 20 * 1024 * 1024) {
      setError("This image is too large. Choose an image smaller than 20 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(next);
      bitmap.close();
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(String(reader.result));
        setFile(next);
        setName((current) => current ||
          next.name
            .replace(/\.[^.]+$/, "")
            .replace(/[^\p{L}\p{N}_]/gu, "")
            .slice(0, 100) || "Reference",
        );
        setError("");
      };
      reader.readAsDataURL(next);
    } catch {
      setError(
        "This file could not be opened as an image. Please choose another.",
      );
    }
  }
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file || !supabase) return;
    setBusy(true);
    setError("");
    try {
      const id = crypto.randomUUID();
      const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const path = `${userId}/${id}/original.${ext}`;
      const stored = await supabase.storage
        .from(REFERENCE_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });
      if (stored.error) throw stored.error;
      const inserted = await supabase.from(REFERENCE_TABLE).insert({
        id,
        owner_id: userId,
        name: name.trim(),
        description: description.trim(),
        storage_path: path,
      });
      if (inserted.error)
        throw new Error(
          "The file uploaded, but its library record could not be saved. Please retry; the unlinked file will need backend cleanup.",
        );
      const url = supabase.storage.from(REFERENCE_BUCKET).getPublicUrl(path)
        .data.publicUrl;
      onUploaded({
        id,
        name: name.trim(),
        description: description.trim(),
        url,
        category: "Image",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Give your story a familiar face."
      eyebrow="ADD A REFERENCE"
      onClose={onClose}
    >
      <p className="modal-intro">
        Characters, places, little details. Upload once, use in any project.
      </p>
      <form onSubmit={upload}>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            void choose(e.target.files?.[0]);
          }}
        />
        <button
          type="button"
          className={`dropzone ${drag ? "dragging" : ""} ${preview ? "has-preview" : ""}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void choose(e.dataTransfer.files[0]);
          }}
        >
          {preview ? (
            <>
              <Photo key={preview} src={preview} alt="Selected image preview" />
              <span>
                <Check size={16} />
                {file?.name} · Click to change
              </span>
            </>
          ) : (
            <>
              <span className="upload-icon">
                <ImagePlus size={25} />
              </span>
              <strong>Drop an image here, or browse</strong>
              <span>JPEG, PNG, WebP · up to 20 MB</span>
            </>
          )}
        </button>
        <label className="field">
          Reference name
          <input
            value={name}
            onChange={(e) =>
              setName(e.target.value.replace(/[^\p{L}\p{N}_]/gu, ""))
            }
            required
            maxLength={100}
            placeholder="e.g. Elena or WhisperingForest"
          />
          <span className="field-hint">
            Mention this image as @{name || "ReferenceName"} in your scene.
          </span>
        </label>
        <label className="field">
          A little context <span className="optional">Optional</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Who or what does this image represent?"
          />
        </label>
        <p className="small muted">
          Images are public and viewable by anyone with their link.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={!file || busy || !name.trim()}
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Upload size={16} />
            )}
            {busy ? "Uploading…" : "Add to library"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
