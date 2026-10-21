import { Button } from "@keiro-ui/ui/components/button"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, test, vi } from "vitest"

test("Button renders with its accessible name and fires onPress", async () => {
  const spy = vi.fn()
  render(<Button onPress={spy}>Save</Button>)

  const button = screen.getByRole("button", { name: "Save" })
  expect(button).toBeInTheDocument()

  await userEvent.setup().click(button)
  expect(spy).toHaveBeenCalledTimes(1)
})
