import type { MockControls } from "@keiro-ui/testing/browser"

declare global {
  interface Window {
    __keiroUiMock?: MockControls
  }
}
