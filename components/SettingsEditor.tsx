"use client";
import { useState, useEffect } from "react";
import { resetImageConfigCache } from "@/lib/image-gen";

interface SettingsData {
  url: string;
  apiKey: string;
  model: string;
  creationModel: string;
  imageUrl: string;
  imageApiKey: string;
  imageModel: string;
  imageApiType: string;
}

export default function SettingsEditor() {
  const [form, setForm] = useState<SettingsData>({
    url: "",
    apiKey: "",
    model: "",
    creationModel: "",
    imageUrl: "",
    imageApiKey: "",
    imageModel: "",
    imageApiType: "openai",
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsData) => {
        setForm(d);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  function handleChange(field: keyof SettingsData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setStatus("");
  }

  async function handleSave() {
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.error) {
        setStatus(`保存失败：${data.error}`);
      } else {
        setForm(data);
        setStatus("保存成功");
        resetImageConfigCache();
      }
    } catch {
      setStatus("保存失败：无法连接服务器");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setStatus("测试连接中...");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Hi" }],
          stream: false,
          max_tokens: 8,
        }),
      });
      if (res.ok) {
        setStatus("连接成功");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus(`连接失败：${data.error || res.status}`);
      }
    } catch {
      setStatus("连接失败：无法连接服务器");
    }
  }

  async function handleTestImage() {
    setStatus("测试图像 API...");
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: "A simple test: a small red circle on white background",
          size: "256x256",
        }),
      });
      const data = await res.json();
      if (data.configured === false) {
        setStatus("图像 API 未配置");
      } else if (data.url) {
        setStatus("图像 API 连接成功");
      } else {
        setStatus(`图像 API 失败：${data.error || res.status}`);
      }
    } catch {
      setStatus("图像 API 连接失败：无法连接服务器");
    }
  }

  if (!loaded) {
    return (
      <section className="script-section">
        <div className="loading-dots">加载配置</div>
      </section>
    );
  }

  return (
    <>
      <section className="script-section">
        <div className="script-section-heading">
          <h2>API 配置</h2>
          <p>设置 OpenAI 兼容的 API 端点和密钥。</p>
        </div>
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <div className="settings-control">
            <label className="settings-label">API URL</label>
            <input
              className="settings-input"
              type="text"
              placeholder="https://api.openai.com"
              value={form.url}
              onChange={(e) => handleChange("url", e.target.value)}
            />
          </div>
          <div className="settings-control">
            <label className="settings-label">API Key</label>
            <input
              className="settings-input"
              type="password"
              placeholder="sk-..."
              value={form.apiKey}
              onChange={(e) => handleChange("apiKey", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="script-section">
        <div className="script-section-heading">
          <h2>模型配置</h2>
          <p>游戏叙事和世界创建可使用不同模型。</p>
        </div>
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <div className="settings-control">
            <label className="settings-label">叙事模型</label>
            <input
              className="settings-input"
              type="text"
              placeholder="gpt-4o"
              value={form.model}
              onChange={(e) => handleChange("model", e.target.value)}
            />
          </div>
          <div className="settings-control">
            <label className="settings-label">创建模型</label>
            <input
              className="settings-input"
              type="text"
              placeholder="留空则使用叙事模型"
              value={form.creationModel}
              onChange={(e) => handleChange("creationModel", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="script-section">
        <div className="script-section-heading">
          <h2>插画生成配置（可选）</h2>
          <p>配置图像生成 API，为世界和故事生成场景插画。未配置时游戏正常运行。</p>
        </div>
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <div className="settings-control">
            <label className="settings-label">API 类型</label>
            <select
              className="settings-input"
              value={form.imageApiType}
              onChange={(e) => handleChange("imageApiType", e.target.value)}
            >
              <option value="openai">OpenAI 兼容 (/v1/images)</option>
              <option value="chat">Chat 文生图 (/v1/chat)</option>
              <option value="google">Google Gemini (/v1beta)</option>
            </select>
          </div>
          <div className="settings-control">
            <label className="settings-label">图像 API URL</label>
            <input
              className="settings-input"
              type="text"
              placeholder="https://api.openai.com"
              value={form.imageUrl}
              onChange={(e) => handleChange("imageUrl", e.target.value)}
            />
          </div>
          <div className="settings-control">
            <label className="settings-label">图像 API Key</label>
            <input
              className="settings-input"
              type="password"
              placeholder="sk-..."
              value={form.imageApiKey}
              onChange={(e) => handleChange("imageApiKey", e.target.value)}
            />
          </div>
          <div className="settings-control">
            <label className="settings-label">图像模型</label>
            <input
              className="settings-input"
              type="text"
              placeholder="dall-e-3"
              value={form.imageModel}
              onChange={(e) => handleChange("imageModel", e.target.value)}
            />
          </div>
        </div>
      </section>

      {status && <p className="settings-status">{status}</p>}

      <div className="script-command-row" style={{ marginTop: 20 }}>
        <button
          type="button"
          className="primary-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleTest}
        >
          测试连接
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleTestImage}
        >
          测试图像 API
        </button>
        <a href="/" className="outline-button">
          返回首页
        </a>
      </div>
    </>
  );
}
