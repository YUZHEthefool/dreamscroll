"use client";
import WorldCreator from "@/components/WorldCreator";

export default function CreatePage() {
  return (
    <main className="page-shell">
      <section className="manuscript-page">
        <div className="news-masthead">
          <span>World Architect</span>
          <strong>世界构建</strong>
          <span>Creation Studio</span>
        </div>

        <header className="news-hero">
          <p className="manuscript-kicker">NEW WORLD BLUEPRINT</p>
          <h1 className="news-headline">创世</h1>
          <p className="news-deck">
            描述你脑海中的世界，AI 会为你构建完整的世界观、角色、关键节点和多种结局。
          </p>
        </header>

        <WorldCreator />
      </section>
    </main>
  );
}
