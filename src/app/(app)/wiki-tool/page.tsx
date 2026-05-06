import { WikiToolTabs } from "@/components/wiki-tool-tabs";

export const dynamic = "force-dynamic";

export default function WikiToolPage() {
  return (
    <div className="page-grid">
      <section className="hero panel">
        <div className="hero-copy-block">
          <p className="eyebrow">WikiTool</p>
          <h2>How the platform works</h2>
          <p className="hero-copy">
            This page explains the logic behind the metrics, labels, and actions used in
            Agora Team Analytics. Use it as the reference layer for the whole tool.
          </p>
        </div>
        <div className="hero-focus">
          <span>Best use</span>
          <strong>Open this when a metric is not obvious</strong>
          <small>
            Each tab focuses on one area so the explanations stay simple and fast to scan.
          </small>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <p className="eyebrow">Reference</p>
          <h2>Metric logic and label guide</h2>
        </div>
        <WikiToolTabs />
      </section>
    </div>
  );
}
