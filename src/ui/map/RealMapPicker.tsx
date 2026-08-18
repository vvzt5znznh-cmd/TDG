import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  TILE_LAYERS,
  groundWidthMeters,
  pickerViewFromSource,
  scaleBarMeters,
  snapshotExtent,
  type GeoBounds,
  type MapFrameSource,
} from "../../map/realmap";

/**
 * Frame an OSM / topo extent and snapshot it onto the sheet. Reopens on the
 * last capture so a small pan or zoom is an adjustment, not a new search.
 */
export default function RealMapPicker({
  source,
  onUse,
  onClose,
}: {
  source?: MapFrameSource | null;
  onUse: (dataUrl: string, scaleMeters: number, next: MapFrameSource) => void;
  onClose: () => void;
}) {
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const start = pickerViewFromSource(source);
  const layerIdRef = useRef<string>(start.layerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adjusting = Boolean(source);

  useEffect(() => {
    const node = mapNodeRef.current;
    if (!node || mapRef.current) return;
    const view = pickerViewFromSource(source);
    const map = L.map(node, { center: view.center, zoom: view.zoom, zoomControl: true });
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
    const startLayer = TILE_LAYERS.find((item) => item.id === view.layerId) ?? TILE_LAYERS[0]!;
    layers.get(startLayer.label)!.addTo(map);
    layerIdRef.current = startLayer.id;
    L.control.layers(Object.fromEntries(layers)).addTo(map);
    map.on("baselayerchange", (event) => {
      const def = TILE_LAYERS.find((item) => item.label === event.name);
      if (def) layerIdRef.current = def.id;
    });
    mapRef.current = map;
    requestAnimationFrame(() => {
      map.invalidateSize();
      map.setView(view.center, view.zoom);
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [source]);

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
      const center = map.getCenter();
      const next: MapFrameSource = {
        kind: "tiles",
        layerId: layerIdRef.current,
        bounds,
        center: [center.lat, center.lng],
        zoom: map.getZoom(),
      };
      const layer = TILE_LAYERS.find((item) => item.id === next.layerId) ?? TILE_LAYERS[0]!;
      const dataUrl = await snapshotExtent(layer, bounds);
      const meters = scaleBarMeters(groundWidthMeters(bounds));
      onUse(dataUrl, meters, next);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not capture the map.");
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-label={adjusting ? "Adjust map frame" : "Frame a map"}>
      <div className="modal-panel realmap-panel">
        <div className="realmap-head">
          <div>
            <div className="section-kicker">{adjusting ? "Adjust map" : "Frame a map"}</div>
            <p className="hint" style={{ margin: 0 }}>
              {adjusting
                ? "This is the last view you put on the sheet. Nudge it, then capture again."
                : "Pan and zoom to the place. What you frame becomes the sheet, with a true scale bar. The sheet stays 4:3."}
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
            {busy ? "Capturing…" : adjusting ? "Update the sheet" : "Use this view"}
          </button>
        </div>
      </div>
    </div>
  );
}
