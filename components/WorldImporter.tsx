"use client";
import { useRef, useState } from "react";
import { saveWorld } from "@/lib/store";
import { parseWorldTemplate, templateToWorld } from "@/lib/world-template";

export default function WorldImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);

  function importTemplate(text: string) {
    const template = parseWorldTemplate(text);
    if (!template) {
      setStatus("无法解析模板文件，请确认格式正确。");
      return;
    }
    const world = templateToWorld(template);
    saveWorld(world);
    setStatus(`已导入「${world.title}」`);
    window.location.reload();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("");

    const reader = new FileReader();
    reader.onload = () => importTemplate(reader.result as string);
    reader.onerror = () => setStatus("读取文件失败。");
    reader.readAsText(file);

    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleUrlImport() {
    const url = urlInput.trim();
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        setStatus("仅支持 http:// 或 https:// 链接");
        return;
      }
    } catch {
      setStatus("URL 格式无效");
      return;
    }
    setStatus("");
    setUrlLoading(true);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setStatus(`获取失败 (${res.status})`);
        return;
      }
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
        setStatus("文件过大（超过 2MB），请检查链接。");
        return;
      }
      const text = await res.text();
      importTemplate(text);
    } catch {
      setStatus("无法获取链接内容，请检查 URL 或网络。");
    } finally {
      setUrlLoading(false);
    }
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <button
        type="button"
        className="secondary-button"
        onClick={() => fileRef.current?.click()}
      >
        导入模板
      </button>
      <button
        type="button"
        className="outline-button"
        onClick={() => setUrlMode((v) => !v)}
      >
        {urlMode ? "收起链接" : "从链接导入"}
      </button>
      {urlMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, width: "100%" }}>
          <input
            className="url-import-input"
            type="text"
            placeholder="粘贴模板 JSON 的 URL..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUrlImport()}
          />
          <button
            type="button"
            className="primary-button"
            onClick={handleUrlImport}
            disabled={urlLoading || !urlInput.trim()}
          >
            {urlLoading ? "获取中..." : "导入"}
          </button>
        </div>
      )}
      {status && (
        <span className="settings-status" style={{ marginTop: 0 }}>
          {status}
        </span>
      )}
    </>
  );
}
