import { scaleGeometry } from "../../map/geometry";
import {
  DEFAULT_AXIS_WIDTH,
  GRAPHIC_DEFS,
  MAX_HEAD_RATIO,
  MIN_HEAD_PX,
  defaultPointsAt,
  isAxisKind,
  renderControlMeasure,
  type RenderedGraphic,
} from "../../map/milstd";
import type { ControlMeasureKind } from "../../schema/types";
import { useMilStdReady } from "./useMilStd";

const SCALES = [0.25, 0.5, 1, 2, 4] as const;
const AXIS_KINDS = ["axis_of_advance", "axis_supporting", "axis_aviation"] as const;

export function GraphicsSnapshotPage() {
  const ready = useMilStdReady();
  if (!ready) return <p className="graphics-snapshot-loading">Loading Army renderer…</p>;
  return (
    <div className="graphics-snapshot">
      <header className="graphics-snapshot-head">
        <h1>Tactical graphics snapshot</h1>
        <p>
          Every catalog kind at 0.25×–4×, then axis bearings every 15°. Rendered only through{" "}
          <code>renderControlMeasure</code>. Head clamp MIN_HEAD_PX={MIN_HEAD_PX}, MAX_HEAD_RATIO={MAX_HEAD_RATIO}.
        </p>
      </header>
      {GRAPHIC_DEFS.map((def) => (
        <section key={def.kind} className="graphics-snapshot-section">
          <h2>
            {def.label} <span>{def.kind}</span>
          </h2>
          <div className="graphics-snapshot-row">
            {SCALES.map((factor) => (
              <SnapshotCell key={factor} kind={def.kind} label={`${factor}×`} scale={factor} />
            ))}
          </div>
        </section>
      ))}
      {AXIS_KINDS.map((kind) => (
        <section key={`${kind}-bearings`} className="graphics-snapshot-section">
          <h2>
            {kind} bearings <span>0°–165° / 15°</span>
          </h2>
          <div className="graphics-snapshot-row">
            {Array.from({ length: 12 }, (_, i) => i * 15).map((deg) => (
              <AxisBearingCell key={deg} kind={kind} deg={deg} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SnapshotCell({ kind, label, scale }: { kind: ControlMeasureKind; label: string; scale: number }) {
  const pts = defaultPointsAt(kind, [800, 600]);
  const base = pts.length === 1 ? { type: "Point" as const, coordinates: pts[0]! } : { type: "LineString" as const, coordinates: pts };
  const geometry = scaleGeometry(base, scale, [800, 600]);
  const rendered = renderControlMeasure({
    kind,
    geometry,
    label: "",
    axisWidth: isAxisKind(kind) ? DEFAULT_AXIS_WIDTH * scale : undefined,
  });
  return <GraphicFrame rendered={rendered} caption={label} />;
}

function AxisBearingCell({ kind, deg }: { kind: (typeof AXIS_KINDS)[number]; deg: number }) {
  const rad = (deg * Math.PI) / 180;
  const L = 300;
  const tip: [number, number] = [800 + Math.cos(rad) * (L / 2), 600 - Math.sin(rad) * (L / 2)];
  const rear: [number, number] = [800 - Math.cos(rad) * (L / 2), 600 + Math.sin(rad) * (L / 2)];
  const rendered = renderControlMeasure({
    kind,
    geometry: { type: "LineString", coordinates: [tip, rear] },
    label: "",
    axisWidth: DEFAULT_AXIS_WIDTH,
  });
  return <GraphicFrame rendered={rendered} caption={`${deg}°`} />;
}

function GraphicFrame({ rendered, caption }: { rendered: RenderedGraphic | null; caption: string }) {
  if (!rendered) {
    return (
      <figure className="graphics-snapshot-cell is-fail">
        <div className="graphics-snapshot-fail">null</div>
        <figcaption>{caption}</figcaption>
      </figure>
    );
  }
  const w = Math.max(8, rendered.width);
  const h = Math.max(8, rendered.height);
  return (
    <figure className="graphics-snapshot-cell">
      <svg xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <g dangerouslySetInnerHTML={{ __html: rendered.innerSvg }} />
      </svg>
      <figcaption>
        {caption} · {Math.round(w)}×{Math.round(h)}
      </figcaption>
    </figure>
  );
}
