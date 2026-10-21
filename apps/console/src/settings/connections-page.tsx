import { Badge } from "@keiro-ui/ui/components/badge"
import { Button } from "@keiro-ui/ui/components/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@keiro-ui/ui/components/field"
import { Input } from "@keiro-ui/ui/components/input"
import { Textarea } from "@keiro-ui/ui/components/textarea"
import { useId, useState } from "react"

import { PageHeader } from "@/components/page-header"

import {
  type ConnectionProfile,
  connectionProfileSchema,
  sameOriginProfile,
  type Surface,
  surfaceBaseUrl,
  surfaces,
  useConnectionProfiles,
} from "./connection-profiles"

const blankOrigins: Record<Surface, string> = { kiroku: "", shibuya: "", pgmq: "", keiro: "" }

function newProfile(): ConnectionProfile {
  return {
    id: `profile-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
    mode: "separate",
    origins: { ...blankOrigins },
  }
}

type Errors = Partial<Record<"name" | Surface, string>>

function validate(profile: ConnectionProfile): Errors {
  const result = connectionProfileSchema.safeParse(profile)
  if (result.success) return {}
  const errors: Errors = {}
  for (const issue of result.error.issues) {
    const key = (issue.path[0] === "origins" ? issue.path[1] : issue.path[0]) as keyof Errors
    errors[key] ??= issue.message
  }
  return errors
}

function ProfileForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: ConnectionProfile
  onSaved: (profile: ConnectionProfile) => void
  onCancel: () => void
}) {
  const formId = useId()
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)

  const update = (next: ConnectionProfile) => {
    setDraft(next)
    if (submitted) setErrors(validate(next))
  }

  const save = () => {
    setSubmitted(true)
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length === 0) onSaved(connectionProfileSchema.parse(draft))
  }

  return (
    <form
      aria-label="Connection profile"
      className="flex max-w-xl flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <FieldGroup>
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
          <Input
            id={`${formId}-name`}
            value={draft.name}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => update({ ...draft, name: event.target.value })}
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Mode</legend>
          {(["same-origin", "separate"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${formId}-mode`}
                value={mode}
                checked={draft.mode === mode}
                onChange={() => update({ ...draft, mode })}
              />
              {mode === "same-origin"
                ? "Same origin (surfaces under /kiroku, /shibuya, /pgmq, /keiro)"
                : "Separate origins (one per surface)"}
            </label>
          ))}
        </fieldset>
        {draft.mode === "separate" &&
          surfaces.map((surface) => (
            <Field key={surface} data-invalid={errors[surface] ? true : undefined}>
              <FieldLabel htmlFor={`${formId}-${surface}`}>{surface} origin</FieldLabel>
              <Input
                id={`${formId}-${surface}`}
                placeholder="http://127.0.0.1:9091"
                value={draft.origins[surface]}
                aria-invalid={errors[surface] ? true : undefined}
                onChange={(event) =>
                  update({ ...draft, origins: { ...draft.origins, [surface]: event.target.value } })
                }
              />
              {errors[surface] && <FieldError>{errors[surface]}</FieldError>}
            </Field>
          ))}
        <Field>
          <FieldLabel htmlFor={`${formId}-dlq-suffix`}>Dead-letter queue suffix</FieldLabel>
          <Input
            id={`${formId}-dlq-suffix`}
            placeholder="_dlq"
            value={draft.deadLetterQueueSuffix ?? ""}
            onChange={(event) =>
              update({ ...draft, deadLetterQueueSuffix: event.target.value || undefined })
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-pm-names`}>Process manager names</FieldLabel>
          {/* keiro exposes no list of mounted process managers; the index page offers these. */}
          <Textarea
            id={`${formId}-pm-names`}
            placeholder="One name per line"
            value={(draft.processManagerNames ?? []).join("\n")}
            onChange={(event) => {
              const names = event.target.value.split("\n")
              update({
                ...draft,
                processManagerNames: names.some((n) => n.trim()) ? names : undefined,
              })
            }}
          />
        </Field>
      </FieldGroup>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button variant="outline" onPress={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ImportExport() {
  const { exportJson, importJson } = useConnectionProfiles()
  const [text, setText] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  return (
    <section className="flex max-w-xl flex-col gap-2">
      <h2 className="text-sm font-semibold">Export / import</h2>
      <Textarea
        aria-label="Connection profiles JSON"
        className="min-h-32 font-mono text-xs"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onPress={() => {
            setText(exportJson())
            setMessage("Exported the custom profiles.")
          }}
        >
          Export
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            try {
              const { imported } = importJson(text)
              setMessage(`Imported ${imported} profile${imported === 1 ? "" : "s"}.`)
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Import failed")
            }
          }}
        >
          Import
        </Button>
        {message && (
          <span role="status" className="text-xs text-muted-foreground">
            {message}
          </span>
        )}
      </div>
    </section>
  )
}

export function ConnectionsPage() {
  const { profiles, active, setActive, upsert, remove } = useConnectionProfiles()
  const [editing, setEditing] = useState<ConnectionProfile | null>(null)

  return (
    <>
      <PageHeader
        title="Connections"
        description="Where the console finds the kiroku, shibuya, pgmq, and keiro surfaces."
        actions={
          <Button onPress={() => setEditing(newProfile())} isDisabled={editing !== null}>
            New profile
          </Button>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        <ul
          aria-label="Connection profiles"
          className="flex max-w-xl flex-col divide-y rounded-lg border"
        >
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center justify-between gap-4 p-3">
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 font-medium">
                  {profile.name}
                  {profile.id === active.id && <Badge>active</Badge>}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {profile.mode === "same-origin"
                    ? `${surfaceBaseUrl(profile, "kiroku", window.location.origin)}, …`
                    : surfaces.map((s) => profile.origins[s]).join(", ")}
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={profile.id === active.id}
                  onPress={() => setActive(profile.id)}
                >
                  Use this profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={profile.id === sameOriginProfile.id}
                  onPress={() => setEditing(profile)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  isDisabled={profile.id === sameOriginProfile.id}
                  onPress={() => remove(profile.id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {editing && (
          <ProfileForm
            key={editing.id}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={(profile) => {
              upsert(profile)
              setEditing(null)
            }}
          />
        )}
        <ImportExport />
      </div>
    </>
  )
}
