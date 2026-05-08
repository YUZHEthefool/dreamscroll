"use client";
import { useRef, useState } from "react";
import { saveWorld } from "@/lib/store";
import { parseWorldTemplate, templateToWorld } from "@/lib/world-template";

export default function WorldImporter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("");

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const template = parseWorldTemplate(text);
      if (!template) {
        setStatus("无法解析模板文件，请确认格式正确。");
        return;
      }
      const world = templateToWorld(template);
      saveWorld(world);
      setStatus(`已导入「${world.title}」`);
      window.location.reload();
    };
    reader.onerror = () => setStatus("读取文件失败。");
    reader.readAsText(file);

    if (fileRef.current) fileRef.current.value = "";
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
      {status && (
        <span className="settings-status" style={{ marginTop: 0 }}>
          {status}
        </span>
      )}
    </>
  );
}
