"use client";
import { Suspense } from "react";
import GamePage from "@/components/GamePage";

export default function Game() {
  return (
    <main className="page-shell">
      <section className="manuscript-page">
        <div className="news-masthead">
          <span>Interactive Fiction</span>
          <strong>织梦录</strong>
          <span>In Progress</span>
        </div>

        <Suspense
          fallback={
            <section className="script-section">
              <div className="loading-dots">加载中</div>
            </section>
          }
        >
          <GamePage />
        </Suspense>
      </section>
    </main>
  );
}
