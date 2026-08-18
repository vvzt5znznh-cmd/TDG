import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TILE_LAYERS, groundWidthMeters, scaleBarMeters, snapshotExtent, type GeoBounds } from "../../map/realmap";

/**
 * Frame a real-world extent on a free interactive map (inspired by
 * mgrs-mapper.com) and snapshot it into the sheet's underlay. The result is a
 * plain raster inside the .tdg.json, so the file stays portable and printable.
 */
export default function RealMapPicker({
  onUse,
  onClose,
}: {
  onUse: (dataUrl: string, scaleMeters: number) => void;
  onClose: () => void;
}) {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerIdRef = useRef<string>(TILE_LAYERS[0]!.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = mapNodeRef.current;
    if (!node || mapRef.current) return;
    const map = L.map(node, { center: [60.4, 11.2], zoom: 11, zoomControl: true });
    const layers = new Map<string, L.TileLayer>();
    for (const def of TILE_LAYERS) {
      layers.set(
        def.label,
        L.tileLayer(def.urlTemplate.replace("https://a.tile", "https://{s}.tile"), {
          maxZoom: def.maxZoom,
          attribution: def.attribution,
          subdomains: "abc",
        }),
      );
    }
    const first = layers.get(TILE_LAYERS[0]!.label)!;
    first.addTo(map);
    L.control.layers(Object.fromEntries(layers)).addTo(map);
    map.on("baselayerchange", (event) => {
      const def = TILE_LAYERS.find((item) => item.label === event.name);
      if (def) layerIdRef.current = def.id;
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  async function captureGround() {
    const map = mapRef.current;
    if (!map || busy) return;
    setBusy(true);
    setError(null);
    try {
      const b = map.getBounds();
      const bounds: GeoBounds = {
        west: b.getWest(),
        south: b.getSouth(),
        east: b.getEast(),
        north: b.getNorth(),
      };
      const layer = TILE_LAYERS.find((item) => item.id === layerIdRef.current) ?? TILE_LAYERS[0]!;
      const dataUrl = await snapshotExtent(layer, bounds);
      const meters = scaleBarMeters(groundWidthMeters(bounds));
      onUse(dataUrl, meters);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not capture the map.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-label="Pick real ground">
      <div className="modal-panel realmap-panel">
        <div className="realmap-head">
          <div>
            <div className="section-kicker">Real ground</div>
            <p className="hint" style={{ margin: 0 }}>
              Pan and zoom to the area. What you frame becomes the sheet's base, with a true
              scale bar. The sheet stays 4:3.
            </p>
          </div>
          <button type="button" className="tool-btn" onClick={onClose}>
            Close
          </button>
        </div>
        <div ref={mapNodeRef} className="realmap-map" />
        <div className="realmap-actions">
          {error ? <span className="realmap-error">{error}</span> : <span className="hint">Map data © OpenStreetMap contributors.</span>}
          <button type="button" className="tool-btn is-active" disabled={busy} onClick={() => void captureGround()}>
            {busy ? "Capturing…" : "Use this ground"}
          </button>
        </div>
      </div>
    </div>
  );
}
