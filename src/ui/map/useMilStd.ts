import { useEffect, useState } from "react";
import { ensureMilStd, isMilStdReady, onMilStdReady } from "../../map/milstd";

/** True once the MIL-STD-2525D renderer module is loaded and initialized. */
export function useMilStdReady(): boolean {
  const [ready, setReady] = useState(isMilStdReady());
  useEffect(() => {
    void ensureMilStd();
    return onMilStdReady(() => setReady(true));
  }, []);
  return ready;
}
