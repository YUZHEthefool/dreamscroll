"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page-shell">
      <section className="manuscript-page">
        <section className="script-section">
          <div className="script-section-heading">
            <h2>页面出错了</h2>
          </div>
          <p className="inline-error">
            {error.message || "未知错误"}
          </p>
          <div className="script-command-row" style={{ marginTop: 16 }}>
            <button type="button" className="primary-button" onClick={reset}>
              重试
            </button>
            <a href="/" className="outline-button">
              返回首页
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
