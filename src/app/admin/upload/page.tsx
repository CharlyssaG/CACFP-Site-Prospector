"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, LogOut, Download, ChevronDown, ChevronUp
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UploadResult {
  inserted: number;
  updated: number;
  errors: { row: number; message: string }[];
}

interface ColumnMap {
  [spreadsheetCol: string]: string;
}

const DB_FIELDS = [
  { key: "name",              label: "Name *",              required: true },
  { key: "address",           label: "Address *",           required: true },
  { key: "city",              label: "City *",              required: true },
  { key: "state",             label: "State *",             required: true },
  { key: "zip",               label: "ZIP *",               required: true },
  { key: "county",            label: "County",              required: false },
  { key: "phone",             label: "Phone",               required: false },
  { key: "email",             label: "Email",               required: false },
  { key: "director_name",     label: "Director Name",       required: false },
  { key: "center_type",       label: "Center Type",         required: false },
  { key: "is_licensed",       label: "Licensed (true/false)",required: false },
  { key: "license_number",    label: "License Number",      required: false },
  { key: "licensed_capacity", label: "Licensed Capacity",   required: false },
  { key: "current_enrollment",label: "Current Enrollment",  required: false },
  { key: "area_eligibility",  label: "Area Eligibility",    required: false },
  { key: "frp_percentage",    label: "FRP %",               required: false },
  { key: "subsidy_pct",       label: "Subsidy %",           required: false },
  { key: "is_cacfp_participant",label: "CACFP Participant", required: false },
  { key: "notes",             label: "Notes",               required: false },
];

export default function AdminUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [showMapping, setShowMapping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Auth guard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/admin");
      else setIsAuthChecking(false);
    });
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin");
  };

  const parseFile = async (f: File) => {
    setResult(null);
    setHeaders([]);
    setPreview([]);
    setColumnMap({});

    const isExcel = f.name.endsWith(".xlsx") || f.name.endsWith(".xls");

    if (isExcel) {
      // Dynamically import xlsx only when needed
      const XLSX = await import("xlsx");
      const buffer = await f.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (rows.length === 0) return;
      const cols = Object.keys(rows[0]);
      setHeaders(cols);
      setPreview(rows.slice(0, 3));
      autoMap(cols);
    } else {
      // CSV
      const text = await f.text();
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) return;
      const cols = lines[0].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const rows = lines.slice(1, 4).map((line) => {
        const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
        return Object.fromEntries(cols.map((c, i) => [c, vals[i] ?? ""]));
      });
      setHeaders(cols);
      setPreview(rows);
      autoMap(cols);
    }
    setShowMapping(true);
  };

  // Auto-map columns by fuzzy name matching
  const autoMap = (cols: string[]) => {
    const map: ColumnMap = {};
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, "");
    for (const col of cols) {
      const n = normalize(col);
      for (const field of DB_FIELDS) {
        if (normalize(field.key) === n || normalize(field.label.replace(" *", "")) === n) {
          map[col] = field.key;
          break;
        }
      }
    }
    setColumnMap(map);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); parseFile(f); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); parseFile(f); }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("columnMap", JSON.stringify(columnMap));

    // Get session token to pass to API
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push("/admin"); return; }

    const res = await fetch("/api/admin/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });

    const data = await res.json();
    setResult(data);
    setIsUploading(false);
  };

  const downloadTemplate = () => {
    const headers = DB_FIELDS.map((f) => f.key).join(",");
    const example = "Example Center,123 Main St,Austin,TX,78701,Travis,512-555-0100,info@example.com,Jane Smith,nonprofit,true,LIC-12345,50,42,eligible,62.5,35.0,false,";
    const blob = new Blob([headers + "\n" + example], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cacfp-centers-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isAuthChecking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-light-gray)" }}>
        <span className="inline-block w-6 h-6 border-2 rounded-full animate-spin"
          style={{ borderColor: "var(--color-subtle-border)", borderTopColor: "var(--color-blue)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--color-light-gray)" }}>
      {/* Header */}
      <header style={{ background: "var(--color-navy)" }}>
        <div className="max-w-3xl mx-auto px-7 py-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-bold mb-1">
              <span style={{ color: "white" }}>Kid</span>
              <span style={{ color: "var(--color-muted-blue)" }}>Kare</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(225,241,249,0.12)", color: "var(--color-muted-blue)" }}>
                Admin
              </span>
            </div>
            <h1 className="text-xl font-extrabold" style={{ color: "white" }}>
              Data Upload
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/sources" className="text-xs font-medium" style={{ color: "var(--color-muted-blue)" }}>
              Data Sources
            </a>
            <a href="/" className="text-xs font-medium" style={{ color: "var(--color-muted-blue)" }}>
              ← Prospector
            </a>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all"
              style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-7 py-8 space-y-6">

        {/* Template download */}
        <div
          className="flex items-center justify-between rounded-xl px-5 py-4"
          style={{ background: "var(--color-light-blue)", border: "1px solid var(--color-subtle-border)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--color-navy)" }}>
              Need a template?
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-text)" }}>
              Download a CSV with all supported column headers and an example row.
            </p>
          </div>
          <button onClick={downloadTemplate} className="btn-outline flex items-center gap-1.5 shrink-0">
            <Download size={13} /> Template
          </button>
        </div>

        {/* Drop zone */}
        <div
          className="rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center py-12 px-6"
          style={{
            borderColor: dragOver ? "var(--color-blue)" : "var(--color-subtle-border)",
            background: dragOver ? "var(--color-light-blue)" : "white",
          }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
          <FileSpreadsheet size={32} className="mx-auto mb-3" style={{ color: "var(--color-blue)" }} />
          {file ? (
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-navy)" }}>{file.name}</p>
              <p className="text-xs mt-1" style={{ color: "var(--color-muted-text)" }}>
                {(file.size / 1024).toFixed(1)} KB — click to replace
              </p>
            </div>
          ) : (
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--color-navy)" }}>
                Drop a CSV or Excel file here
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--color-muted-text)" }}>
                or click to browse — .csv, .xlsx, .xls supported
              </p>
            </div>
          )}
        </div>

        {/* Column mapping */}
        {headers.length > 0 && (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "white", border: "1px solid var(--color-subtle-border)" }}
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4"
              onClick={() => setShowMapping(!showMapping)}
            >
              <div className="text-sm font-semibold text-left" style={{ color: "var(--color-navy)" }}>
                Column Mapping
                <span className="ml-2 text-xs font-normal" style={{ color: "var(--color-muted-text)" }}>
                  {Object.values(columnMap).filter(Boolean).length} of {headers.length} mapped
                </span>
              </div>
              {showMapping
                ? <ChevronUp size={16} style={{ color: "var(--color-muted-text)" }} />
                : <ChevronDown size={16} style={{ color: "var(--color-muted-text)" }} />
              }
            </button>

            {showMapping && (
              <div className="px-5 pb-5 space-y-3 border-t" style={{ borderColor: "var(--color-subtle-border)" }}>
                <p className="text-xs pt-4" style={{ color: "var(--color-muted-text)" }}>
                  Map each column in your file to the matching database field. Unmapped columns are ignored.
                </p>

                {/* Preview */}
                <div className="rounded-xl overflow-x-auto" style={{ border: "1px solid var(--color-subtle-border)" }}>
                  <table className="text-xs w-full">
                    <thead style={{ background: "var(--color-light-blue)" }}>
                      <tr>
                        {headers.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                            style={{ color: "var(--color-navy)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--color-subtle-border)" }}>
                          {headers.map((h) => (
                            <td key={h} className="px-3 py-2 whitespace-nowrap"
                              style={{ color: "var(--color-muted-text)" }}>{row[h]}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mapping selects */}
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  {headers.map((col) => (
                    <div key={col} className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate flex-1 min-w-0"
                        style={{ color: "var(--color-navy)" }}>{col}</span>
                      <span className="text-xs" style={{ color: "var(--color-ink-faint)" }}>→</span>
                      <select
                        className="select-field text-xs py-1 flex-1 min-w-0"
                        value={columnMap[col] || ""}
                        onChange={(e) => setColumnMap((m) => ({ ...m, [col]: e.target.value }))}
                      >
                        <option value="">— skip —</option>
                        {DB_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upload button */}
        {file && headers.length > 0 && (
          <button
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            onClick={handleUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload &amp; Sync Database
              </>
            )}
          </button>
        )}

        {/* Result */}
        {result && (
          <div
            className="rounded-2xl p-5 space-y-3"
            style={{
              background: result.errors.length === 0 ? "var(--color-light-blue)" : "white",
              border: "1px solid var(--color-subtle-border)",
            }}
          >
            <div className="flex items-center gap-2">
              {result.errors.length === 0
                ? <CheckCircle2 size={18} style={{ color: "var(--color-blue)" }} />
                : <AlertTriangle size={18} style={{ color: "#D97706" }} />
              }
              <span className="font-bold text-sm" style={{ color: "var(--color-navy)" }}>
                {result.errors.length === 0 ? "Upload complete" : "Upload finished with errors"}
              </span>
            </div>

            <div className="flex gap-6 text-sm">
              <div>
                <span className="font-bold text-lg" style={{ color: "var(--color-blue)" }}>
                  {result.inserted}
                </span>
                <span className="ml-1 text-xs" style={{ color: "var(--color-muted-text)" }}>new records</span>
              </div>
              <div>
                <span className="font-bold text-lg" style={{ color: "var(--color-navy)" }}>
                  {result.updated}
                </span>
                <span className="ml-1 text-xs" style={{ color: "var(--color-muted-text)" }}>updated</span>
              </div>
              {result.errors.length > 0 && (
                <div>
                  <span className="font-bold text-lg" style={{ color: "#DC2626" }}>
                    {result.errors.length}
                  </span>
                  <span className="ml-1 text-xs" style={{ color: "var(--color-muted-text)" }}>errors</span>
                </div>
              )}
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: "var(--color-subtle-border)" }}>
                {result.errors.map((e, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <XCircle size={13} className="mt-0.5 shrink-0" style={{ color: "#DC2626" }} />
                    <span style={{ color: "var(--color-muted-text)" }}>
                      <strong>Row {e.row}:</strong> {e.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
