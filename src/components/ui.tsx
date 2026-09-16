"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { ImageIcon, X } from "lucide-react";
import type { ReferenceImage } from "@/lib/studio-model";

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

// Shared with MentionEditor so a name that reads as "found" in one place
// reads as "found" in the other -- both must agree on what counts as a mention.
const MENTION_PATTERN = /(@[\p{L}\p{N}_]+)/u;

function getSelectionOffsets(element: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) {
    return null;
  }

  const selectedRange = selection.getRangeAt(0);
  if (!element.contains(selectedRange.startContainer) || !element.contains(selectedRange.endContainer)) {
    return null;
  }

  const before = selectedRange.cloneRange();
  before.selectNodeContents(element);
  before.setEnd(selectedRange.startContainer, selectedRange.startOffset);
  const start = before.toString().length;
  before.setEnd(selectedRange.endContainer, selectedRange.endOffset);
  return { start, end: before.toString().length };
}

function restoreSelectionOffsets(element: HTMLDivElement, start: number, end = start) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = 0;
  let startPoint: [Node, number] | null = null;
  let endPoint: [Node, number] | null = null;
  let node = walker.nextNode();

  while (node) {
    const length = node.textContent?.length ?? 0;
    if (!startPoint && start <= remaining + length) startPoint = [node, start - remaining];
    if (end <= remaining + length) {
      endPoint = [node, end - remaining];
      break;
    }
    remaining += length;
    node = walker.nextNode();
  }

  if (!startPoint || !endPoint) {
    element.focus();
    return;
  }

  const range = document.createRange();
  range.setStart(...startPoint);
  range.setEnd(...endPoint);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
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
      {text.split(MENTION_PATTERN).map((part, i) =>
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

export function MentionEditor({
  text,
  references,
  onChange,
  editorRef,
}: {
  text: string;
  references: ReferenceImage[];
  onChange: (value: string) => void;
  editorRef: RefObject<HTMLDivElement | null>;
}) {
  const historyRef = useRef({ entries: [text], index: 0 });
  const lastCommittedTextRef = useRef(text);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState<{
    start: number;
    end: number;
    value: string;
  } | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const suggestions = mentionQuery
    ? references
        .filter((reference) =>
          reference.name.toLocaleLowerCase().startsWith(mentionQuery.value.toLocaleLowerCase()),
        )
        .slice(0, 5)
    : [];

  function updateMentionQuery(nextText: string, caret: number) {
    const beforeCaret = nextText.slice(0, caret);
    const match = /(?:^|[\s([{'”])@([\p{L}\p{N}_]*)$/u.exec(beforeCaret);
    if (!match) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery({
      start: caret - match[1].length - 1,
      end: caret,
      value: match[1],
    });
    setActiveSuggestion(0);
  }

  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.dataset.mentionValue === text) return;

    if (lastCommittedTextRef.current !== text) {
      historyRef.current = { entries: [text], index: 0 };
      lastCommittedTextRef.current = text;
    }

    const fragment = document.createDocumentFragment();

    text.split(MENTION_PATTERN).forEach((part) => {
      if (!part.startsWith("@")) {
        fragment.append(document.createTextNode(part));
        return;
      }

      const reference = references.find((item) => item.name === part.slice(1));
      const mention = document.createElement("span");
      mention.className = `mention-mark ${reference ? "mention-mark-found" : "mention-mark-missing"}`;

      if (reference) {
        const thumbnail = document.createElement("span");
        thumbnail.className = "mention-mark-thumb";
        thumbnail.setAttribute("aria-hidden", "true");

        const image = document.createElement("img");
        image.src = reference.url;
        image.alt = "";
        image.loading = "lazy";
        image.draggable = false;
        thumbnail.append(image);
        mention.append(thumbnail);
      }

      mention.append(document.createTextNode(part));
      fragment.append(mention);
    });

    editor.replaceChildren(fragment);
    editor.dataset.mentionValue = text;
    const selection = pendingSelectionRef.current;
    if (selection) {
      restoreSelectionOffsets(editor, selection.start, selection.end);
      pendingSelectionRef.current = null;
    }
  }, [editorRef, references, text]);

  function commit(nextText: string, selectionStart: number, selectionEnd = selectionStart) {
    if (nextText === text) {
      pendingSelectionRef.current = { start: selectionStart, end: selectionEnd };
      return;
    }

    const history = historyRef.current;
    history.entries = [...history.entries.slice(0, history.index + 1), nextText];
    history.index = history.entries.length - 1;
    lastCommittedTextRef.current = nextText;
    pendingSelectionRef.current = { start: selectionStart, end: selectionEnd };
    updateMentionQuery(nextText, selectionEnd);
    onChange(nextText);
  }

  function replaceSelection(replacement: string) {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = getSelectionOffsets(editor);
    if (!selection) return;
    const nextText = `${text.slice(0, selection.start)}${replacement}${text.slice(selection.end)}`;
    const caret = selection.start + replacement.length;
    commit(nextText, caret);
  }

  function pastePlainText(event: ReactClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    replaceSelection(event.clipboardData.getData("text/plain"));
  }

  function handleBeforeInput(event: FormEvent<HTMLDivElement>) {
    const input = event.nativeEvent as InputEvent;
    const editor = event.currentTarget;
    const selection = getSelectionOffsets(editor);
    if (!selection) return;

    const selectedText = text.slice(selection.start, selection.end);
    const replace = (value: string) => {
      event.preventDefault();
      replaceSelection(value);
    };

    switch (input.inputType) {
      case "insertText":
      case "insertCompositionText":
        replace(input.data ?? "");
        break;
      case "insertLineBreak":
      case "insertParagraph":
        replace("\n");
        break;
      case "deleteContentBackward":
        event.preventDefault();
        if (selection.start !== selection.end) replaceSelection("");
        else if (selection.start > 0) {
          const start = selection.start - 1;
          commit(`${text.slice(0, start)}${text.slice(selection.end)}`, start);
        }
        break;
      case "deleteContentForward":
        event.preventDefault();
        if (selection.start !== selection.end) replaceSelection("");
        else if (selection.end < text.length) {
          commit(`${text.slice(0, selection.start)}${text.slice(selection.end + 1)}`, selection.start);
        }
        break;
      case "deleteByCut":
        event.preventDefault();
        if (selectedText) replaceSelection("");
        break;
      case "historyUndo": {
        event.preventDefault();
        const history = historyRef.current;
        if (history.index === 0) break;
        history.index -= 1;
        const nextText = history.entries[history.index];
        lastCommittedTextRef.current = nextText;
        pendingSelectionRef.current = { start: Math.min(selection.start, nextText.length), end: Math.min(selection.start, nextText.length) };
        onChange(nextText);
        break;
      }
      case "historyRedo": {
        event.preventDefault();
        const history = historyRef.current;
        if (history.index >= history.entries.length - 1) break;
        history.index += 1;
        const nextText = history.entries[history.index];
        lastCommittedTextRef.current = nextText;
        pendingSelectionRef.current = { start: Math.min(selection.start, nextText.length), end: Math.min(selection.start, nextText.length) };
        onChange(nextText);
        break;
      }
    }
  }

  function syncNativeInput(event: FormEvent<HTMLDivElement>) {
    const editor = event.currentTarget;
    const nextText = editor.textContent ?? "";
    if (nextText === text) return;

    const selection = getSelectionOffsets(editor);
    const caret = selection?.end ?? nextText.length;
    const history = historyRef.current;
    history.entries = [...history.entries.slice(0, history.index + 1), nextText];
    history.index = history.entries.length - 1;
    lastCommittedTextRef.current = nextText;
    pendingSelectionRef.current = { start: caret, end: caret };
    updateMentionQuery(nextText, caret);
    onChange(nextText);
  }

  function insertSuggestion(reference: ReferenceImage) {
    if (!mentionQuery) return;
    const suffix = text.slice(mentionQuery.end);
    const spaceAfter = suffix
      ? (/^[\s.,;:!?)]/.test(suffix) ? "" : " ")
      : " ";
    const replacement = `@${reference.name}${spaceAfter}`;
    const nextText = `${text.slice(0, mentionQuery.start)}${replacement}${suffix}`;
    const caret = mentionQuery.start + replacement.length;
    setMentionQuery(null);
    commit(nextText, caret);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + suggestions.length - 1) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      insertSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setMentionQuery(null);
    }
  }

  return (
    <div className="mention-editor-shell">
      <div
        ref={editorRef}
        id="clip-description"
        className="mention-editor"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Readable clip description"
        aria-multiline="true"
        aria-autocomplete="list"
        aria-controls={suggestions.length ? "reference-autocomplete" : undefined}
        onBeforeInput={handleBeforeInput}
        onInput={syncNativeInput}
        onKeyDown={handleKeyDown}
        onPaste={pastePlainText}
      />
      {suggestions.length > 0 && (
        <div id="reference-autocomplete" className="mention-autocomplete" role="listbox" aria-label="Reference suggestions">
          {suggestions.map((reference, index) => (
            <button
              key={reference.id}
              type="button"
              role="option"
              aria-selected={index === activeSuggestion}
              className={index === activeSuggestion ? "active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertSuggestion(reference)}
            >
              <Photo src={reference.url} alt="" />
              <span>@{reference.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
