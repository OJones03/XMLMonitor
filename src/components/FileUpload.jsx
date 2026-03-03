import { useCallback, useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";

/**
 * Drag-and-drop + click-to-browse file upload zone.
 * Accepts .xml files only. Calls `onFileContent(xmlString)` on success.
 */
export default function FileUpload({ onFileContent }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  const handleFile = useCallback(
    (file) => {
      setError(null);
      if (!file) return;
      if (!file.name.endsWith(".xml")) {
        setError("Only .xml files are supported.");
        return;
      }
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (e) => onFileContent(e.target.result);
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file);
    },
    [onFileContent]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-all duration-200
        ${dragging
          ? "border-sky-400 bg-sky-400/5"
          : "border-slate-700 hover:border-slate-500 bg-slate-900/50"
        }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />

      {fileName ? (
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-10 w-10 text-sky-400" />
          <p className="text-sm font-medium text-slate-200">{fileName}</p>
          <p className="text-xs text-slate-500">Click or drag to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-10 w-10 text-slate-500" />
          <p className="text-sm font-medium text-slate-300">
            Drop an Nmap <span className="text-sky-400">.xml</span> file here
          </p>
          <p className="text-xs text-slate-500">or click to browse</p>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs font-medium text-red-400">{error}</p>
      )}
    </div>
  );
}
