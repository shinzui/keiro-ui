import { registerQueuesFeature } from "./queues/register"
import { registerStreamsFeature } from "./streams/register"

// One line per screen plan: registerStreamsFeature(), registerQueuesFeature(),
// registerWorkflowsFeature(), registerAggregatesFeature(), registerProjectionsFeature().
// __root.tsx calls registerAllFeatures() once before the first render.
export function registerAllFeatures(): void {
  registerStreamsFeature()
  registerQueuesFeature()
}
