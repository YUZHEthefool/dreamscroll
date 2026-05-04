"use client";
import SaveList from "@/components/SaveList";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="manuscript-page">
        <div className="news-masthead">
          <span>AI Interactive Fiction</span>
          <strong>织梦录</strong>
          <span>Open World Edition</span>
        </div>

        <header className="news-hero">
          <p className="manuscript-kicker">
            TYPEWRITTEN STORY DRAFT / LOCAL STORAGE SESSION
          </p>
          <h1 className="news-headline">织梦录</h1>
          <p className="news-deck">
            AI
            驱动的开放世界文字交互游戏。世界由你构建，故事因你而生。在关键节点做出抉择，书写独属于你的结局。
          </p>
        </header>

        <div className="news-stat-strip">
          <span>开放叙事</span>
          <span>多结局分支</span>
          <span>本地存档</span>
        </div>

        <div className="news-columns">
          <div className="news-column news-column-feature">
            <div className="script-divider">
              <span>游戏指南</span>
            </div>

            <section className="script-section">
              <div className="script-section-heading">
                <h2>玩法说明</h2>
                <p>AI 生成世界，你来书写故事。</p>
              </div>
              <div className="script-prose" style={{ marginTop: 12 }}>
                <p>
                  <span className="script-label">一</span>
                  点击「新建世界」，输入你想要的世界创意。AI
                  会生成完整的世界观、角色和剧情框架。
                </p>
                <p>
                  <span className="script-label">二</span>
                  游戏中你可以自由输入文字来探索世界、与 NPC
                  对话、采取行动。AI 会根据你的输入推进叙事。
                </p>
                <p>
                  <span className="script-label">三</span>
                  当剧情发展到关键节点时，系统会呈现固定的选项按钮。这些选择不可撤回，将直接影响故事走向。
                </p>
                <p>
                  <span className="script-label">四</span>
                  你在各个关键节点的选择组合将决定最终的结局。每个世界有多种结局等待你去解锁。
                </p>
                <p>
                  <span className="script-label">五</span>
                  所有游戏数据保存在当前浏览器的本地存储中。AI
                  接口通过服务端 settings.json 配置。
                </p>
              </div>
            </section>
          </div>

          <aside className="news-column news-column-side">
            <section className="script-section">
              <div className="script-section-heading">
                <h2>创建新世界</h2>
                <p>描述你想要的世界，AI 来构建。</p>
              </div>
              <div className="script-command-row">
                <a href="/create" className="primary-button">
                  新建世界
                </a>
                <a href="/settings" className="outline-button">
                  API 配置
                </a>
              </div>
              <p className="news-bulletin">
                输入你的创意关键词（类型、风格、世界观灵感），AI
                会生成完整的世界设定、关键节点和多种结局。
              </p>
            </section>

            <section className="script-section">
              <div className="script-section-heading">
                <h2>历史存档</h2>
                <p>你创建过的世界和进行中的游戏。</p>
              </div>
              <SaveList />
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
