import { catalogChipHref } from "../../map/symbolRender";
import type { UnitStamp } from "../../map/stamp";
import { writeStampTransfer } from "../../map/stamp";
import { useMemo } from "react";

export function SymbolChip({
  sidc,
  label,
  stamp,
  onSeed,
}: {
  sidc: string;
  label: string;
  stamp: UnitStamp;
  onSeed?: () => void;
}) {
  const href = useMemo(() => {
    try {
      return catalogChipHref(sidc);
    } catch {
      return "";
    }
  }, [sidc]);
  return (
    <button
      type="button"
      className="symbol-chip"
      title={`Drag ${label} onto the map`}
      draggable
      onDragStart={(event) => {
        writeStampTransfer(event.dataTransfer, stamp);
        try {
          event.dataTransfer.setDragImage(event.currentTarget, event.currentTarget.offsetWidth / 2, event.currentTarget.offsetHeight / 2);
        } catch {
          // browsers that reject setDragImage still drag
        }
      }}
      onClick={onSeed}
    >
      {href ? <img src={href} alt="" draggable={false} /> : null}
      <span>{label}</span>
    </button>
  );
}
