import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Normalizes documentUrl to convert virtual/legacy storage domains (e.g. storage.educore.edu)
 * to accessible local static paths (/uploads/documents/...) while preserving relative or valid absolute URLs.
 */
export function normalizeDocumentUrl(documentUrl?: string | null, documentName?: string | null): string | null {
  if (!documentUrl) return null;
  if (documentUrl.includes("storage.educore.edu")) {
    const fname = documentName || documentUrl.split("/").pop() || "documento_soporte.pdf";
    return `/uploads/documents/${decodeURIComponent(fname)}`;
  }
  return documentUrl;
}

export interface DocumentClassification {
  effectiveUrl: string | null;
  fileName: string;
  ext: string;
  isPdf: boolean;
  isImage: boolean;
  isText: boolean;
  isWord: boolean;
  isExcel: boolean;
  isPowerPoint: boolean;
  isOffice: boolean;
}

/**
 * Classifies a document based on its URL and filename into supported categories.
 */
export function getDocumentType(documentUrl?: string | null, documentName?: string | null): DocumentClassification {
  const effectiveUrl = normalizeDocumentUrl(documentUrl, documentName);
  const hasDoc = Boolean(effectiveUrl || documentName);
  const fileName = documentName || (effectiveUrl && effectiveUrl.split("/").pop()) || "Documento_Soporte.pdf";
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  const isPdf = hasDoc && (ext === "pdf" || Boolean(effectiveUrl?.toLowerCase().includes(".pdf")));
  const isImage =
    hasDoc &&
    (["jpg", "jpeg", "png", "webp", "svg", "gif", "bmp", "avif"].includes(ext) ||
      Boolean(effectiveUrl?.match(/\.(jpg|jpeg|png|webp|svg|gif|bmp|avif)($|\?)/i)) ||
      Boolean(effectiveUrl?.startsWith("data:image/")));
  const isText = hasDoc && ["txt", "csv", "log", "json", "xml"].includes(ext);
  const isWord = hasDoc && ["doc", "docx", "odt", "rtf"].includes(ext);
  const isExcel = hasDoc && ["xls", "xlsx"].includes(ext);
  const isPowerPoint = hasDoc && ["ppt", "pptx"].includes(ext);
  const isOffice = isWord || isExcel || isPowerPoint;

  return {
    effectiveUrl,
    fileName,
    ext,
    isPdf,
    isImage,
    isText,
    isWord,
    isExcel,
    isPowerPoint,
    isOffice,
  };
}

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUrl?: string | null;
  documentName?: string | null;
  title?: string;
  submittedByName?: string;
  attendanceDate?: string;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  documentUrl,
  documentName = "Constancia_Digital.pdf",
  title = "Previsualización de Documento de Soporte",
  submittedByName,
  attendanceDate,
}) => {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize and classify document using exported utility
  const docInfo = useMemo(() => getDocumentType(documentUrl, documentName), [documentUrl, documentName]);
  const { effectiveUrl, fileName, ext, isPdf, isImage, isText, isWord, isExcel, isPowerPoint, isOffice } = docInfo;

  // Reset scroll, zoom, error state and load text when opened
  useEffect(() => {
    if (isOpen) {
      setZoom(100);
      setRotation(0);
      setLoadError(false);
      containerRef.current?.scrollTo({ top: 0, behavior: "instant" });

      if (isText && effectiveUrl) {
        setIsLoadingText(true);
        fetch(effectiveUrl)
          .then((res) => (res.ok ? res.text() : Promise.reject(new Error("Error al leer archivo"))))
          .then((txt) => {
            setTextContent(txt);
            setIsLoadingText(false);
          })
          .catch(() => {
            setTextContent(null);
            setIsLoadingText(false);
          });
      } else {
        setTextContent(null);
      }
    }
  }, [isOpen, documentUrl, effectiveUrl, isText]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while preview is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(100);
    setRotation(0);
  };

  const handleDownload = () => {
    if (!effectiveUrl) {
      toast.error("No hay una ruta de archivo digital disponible para descargar.");
      return;
    }
    const link = document.createElement("a");
    link.href = effectiveUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      toast.success("Contenido del archivo copiado al portapapeles.");
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-80 flex items-start sm:items-center justify-center overflow-y-auto bg-slate-950/75 backdrop-blur-sm p-2 sm:p-4 pt-3 sm:pt-6 animate-in fade-in duration-150"
    >
      <div className="w-[94vw] max-w-4xl h-[88vh] max-h-[850px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 my-auto sm:my-0">
        {/* HEADER BAR */}
        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                isPdf
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isImage
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : isExcel
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isWord
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isImage ? (
                <ImageIcon className="w-4 h-4" />
              ) : isExcel ? (
                <FileSpreadsheet className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 truncate" title={fileName}>
                  {fileName}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                    isPdf
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : isImage
                      ? "bg-purple-50 text-purple-700 border-purple-200"
                      : isWord
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : isExcel
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : isPowerPoint
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-slate-200/80 text-slate-700 border-slate-300"
                  }`}
                >
                  {isPdf
                    ? "PDF"
                    : isImage
                    ? "Imagen"
                    : isWord
                    ? "Word"
                    : isExcel
                    ? "Excel"
                    : isPowerPoint
                    ? "PowerPoint"
                    : isText
                    ? "Texto"
                    : ext.toUpperCase() || "Documento"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {submittedByName ? `Radicado por ${submittedByName}` : "Constancia digital adjunta"}
                {attendanceDate ? ` · Inasistencia del ${attendanceDate}` : ""}
              </p>
            </div>
          </div>

          {/* TOOLBAR CONTROLS */}
          <div className="flex items-center gap-2">
            {isImage && (
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs mr-1">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                  title="Alejar (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Restablecer zoom"
                >
                  {zoom}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                  title="Acercar (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRotate}
                  className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors border-l border-slate-100 cursor-pointer"
                  title="Rotar 90°"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isText && textContent && (
              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Copiar texto"
              >
                <Copy className="w-3 h-3 text-slate-600" />
                <span className="hidden sm:inline">Copiar</span>
              </button>
            )}

            {effectiveUrl && (
              <>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                  title="Descargar archivo original a tu dispositivo"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Descargar original</span>
                </button>
                <a
                  href={effectiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ml-1 cursor-pointer"
              aria-label="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DOCUMENT PREVIEW CONTAINER */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-900/5 p-4 overflow-auto flex items-center justify-center relative select-none"
        >
          {effectiveUrl && !loadError ? (
            isPdf ? (
              <div className="w-full h-full bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
                <iframe
                  src={effectiveUrl}
                  className="w-full h-full rounded-xl border-none"
                  title={fileName}
                />
              </div>
            ) : isImage ? (
              <div className="w-full h-full flex items-center justify-center overflow-auto p-2">
                <img
                  src={effectiveUrl}
                  onError={() => setLoadError(true)}
                  alt={fileName}
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: "transform 0.15s ease-out",
                  }}
                  className="max-h-full max-w-full object-contain rounded-lg shadow-md border border-slate-200/80 bg-white"
                />
              </div>
            ) : isText ? (
              <div className="w-full h-full bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden flex flex-col p-4">
                {isLoadingText ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                    Cargando contenido del archivo...
                  </div>
                ) : (
                  <pre className="flex-1 overflow-auto text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {textContent || "Archivo de texto vacío o sin contenido legible."}
                  </pre>
                )}
              </div>
            ) : isOffice ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-lg text-center space-y-4 shadow-lg my-auto">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-xs ${
                    isExcel
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : isWord
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {isExcel ? (
                    <FileSpreadsheet className="w-8 h-8" />
                  ) : (
                    <FileText className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 break-all">{fileName}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {isWord
                      ? "Documento de Microsoft Word original adjuntado"
                      : isExcel
                      ? "Hoja de cálculo de Microsoft Excel original adjuntada"
                      : "Documento de oficina adjuntado"}
                  </p>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  Este formato no admite visor interactivo directo dentro del navegador web. Puedes
                  abrirlo en una pestaña nueva o descargarlo para revisarlo en tu equipo con Word, Excel u
                  otra suite compatible.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar archivo original</span>
                  </button>
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir documento</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center space-y-4 shadow-lg my-auto">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center mx-auto shadow-xs">
                  <FileText className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 break-all">{fileName}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Archivo adjuntado en formato <strong>.{ext || "desconocido"}</strong>
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar para visualizar</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-lg text-center my-auto">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 break-all">{fileName}</h4>
                <p className="text-xs text-slate-500 mt-1">
                  {effectiveUrl
                    ? "No fue posible previsualizar este archivo directamente en el navegador."
                    : "No se aportó archivo digital en este radicado. El soporte se gestiona en formato físico en la secretaría del colegio."}
                </p>
              </div>

              {effectiveUrl && (
                <div className="pt-2 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar archivo original</span>
                  </button>
                  <a
                    href={effectiveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir en pestaña nueva</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER BAR */}
        <div className="px-5 py-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Documento original aportado en la plataforma EduCore</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Cerrar visor
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DocumentPreviewModal;
