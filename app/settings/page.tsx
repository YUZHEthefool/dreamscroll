"use client";
import SettingsEditor from "@/components/SettingsEditor";

export default function SettingsPage() {
  return (
    <main className="page-shell">
      <section className="manuscript-page">
        <div className="news-masthead">
          <span>System Config</span>
          <strong>配置中心</strong>
          <span>Settings</span>
        </div>

        <header className="news-hero">
          <p className="manuscript-kicker">API CONFIGURATION PANEL</p>
          <h1 className="news-headline">配置</h1>
          <p className="news-deck">
            设置 API 端点、密钥和模型。配置保存在服务端 settings.json 中。
          </p>
        </header>

        <SettingsEditor />
      </section>
    </main>
  );
}
