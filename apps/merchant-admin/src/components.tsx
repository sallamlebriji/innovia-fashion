import { useEffect, useRef, type ReactNode } from "react";
import {
  X,
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@innovia/ui";
import { useWords } from "./words";
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const t = useWords();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="modal-header">
        <div>
          <span className="eyebrow">{t("INNOVIA / WORKSPACE")}</span>
          <h2 id="dialog-title">{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label={t("Close dialog")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Notice({ error }: { error: unknown }) {
  const t = useWords();
  return error ? (
    <div role="alert" className="notice">
      {t(error instanceof Error ? error.message : String(error))}
    </div>
  ) : null;
}
export function Loading() {
  const t = useWords();
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{t("Bringing your workspace together…")}</span>
    </div>
  );
}
export function Picture({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`picture ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <ImageIcon size={24} />
      )}
    </div>
  );
}
export function PageTitle({
  eyebrow = "YOUR WORKSPACE",
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
export function Pagination({
  page,
  total,
  limit = 24,
  onChange,
}: {
  page: number;
  total: number;
  limit?: number;
  onChange: (page: number) => void;
}) {
  const t = useWords();
  return (
    <div className="pagination">
      <span>
        {total} {t("records")} · {t("Page")} {page} {t("of")}{" "}
        {Math.max(1, Math.ceil(total / limit))}
      </span>
      <div>
        <Button
          variant="secondary"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ArrowLeft size={15} />
          {t("Previous")}
        </Button>
        <Button
          variant="secondary"
          disabled={page * limit >= total}
          onClick={() => onChange(page + 1)}
        >
          {t("Next")}
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const encode = (v: string | number) =>
    `"${String(v)
      .replace(/^[=+@-]/, "'")
      .replaceAll('"', '""')}"`;
  const blob = new Blob(
    ["\uFEFF" + rows.map((r) => r.map(encode).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
