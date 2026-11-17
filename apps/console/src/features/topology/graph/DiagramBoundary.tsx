import { Component, type ReactNode } from "react"

/**
 * A diagram is an addition to text that already says everything. If one cannot be drawn, the
 * page keeps working and says so, naming where the same information is.
 */
export class DiagramBoundary extends Component<
  { children: ReactNode; fallback: string; testId?: string },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <p
        className="text-sm text-muted-foreground"
        data-testid={this.props.testId ?? "diagram-failed"}
      >
        {this.props.fallback}
      </p>
    )
  }
}
