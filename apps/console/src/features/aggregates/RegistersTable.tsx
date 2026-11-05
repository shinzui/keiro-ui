import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@keiro-ui/ui/components/table"

import { JsonValue } from "@/components/JsonViewer"

import type { Registers } from "./registers"

export function RegistersTable({ registers }: { registers: Registers }) {
  return (
    <section aria-label="Registers" className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground">
        Registers reported by this application
      </h3>
      <Table aria-label="Registers">
        <TableHeader>
          <TableHead isRowHeader>Register</TableHead>
          <TableHead>Value</TableHead>
        </TableHeader>
        <TableBody>
          {Object.entries(registers)
            .toSorted(([a], [b]) => a.localeCompare(b))
            .map(([name, value]) => (
              <TableRow key={name} id={name}>
                <TableCell className="font-mono text-xs">{name}</TableCell>
                <TableCell data-testid={`register-${name}`}>
                  <JsonValue value={value} />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </section>
  )
}
