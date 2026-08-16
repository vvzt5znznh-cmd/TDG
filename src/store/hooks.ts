import { useDocument } from "./document";
import { isScenario, type Scenario } from "../schema/types";

export function useScenario(): Scenario | null {
  const file = useDocument((state) => state.file);
  return isScenario(file.content) ? file.content : null;
}

export { useDocument } from "./document";
