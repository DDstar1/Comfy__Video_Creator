"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, X } from "lucide-react";

export function Photo({
  src,
  alt,
  className = "",
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className={`photo-placeholder ${className}`}>
        <ImageIcon size={26} aria-hidden="true" />
        <span>{alt}</span>
      </div>
    );
  // Public reference URLs are dynamic and also consumed by GPU workers.
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Public reference URLs are rendered directly; no proxy credentials or host allowlist required.
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    dialog
      ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="file"]), textarea',
      )
      ?.focus();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id="modal-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Mentions({
  text,
  onMention,
}: {
  text: string;
  onMention: (name: string) => void;
}) {
  return (
    <>
      {text.split(/(@[\p{L}\p{N}_]+)/u).map((part, i) =>
        part.startsWith("@") ? (
          <button
            key={i}
            className="mention-inline"
            onClick={() => onMention(part.slice(1))}
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
