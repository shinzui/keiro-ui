let Schema =
      https://raw.githubusercontent.com/shinzui/mori-schema/e4899c15b6a7c36f5d6f2619c8a36ceabe58fc41/package.dhall
        sha256:f33943bf2a160e4dc2087e482a3e784d39e79ff58d5ec67c1f53bcee3389e323

in  Schema.Project::{
    , project = Schema.ProjectIdentity::{
      , name = "keiro-ui"
      , namespace = "shinzui"
      , stableId = Some "project_01m0eh2z66e4f8qx43fq70berz"
      , type = Schema.PackageType.Application
      , language = Schema.Language.TypeScript
      , lifecycle = Schema.Lifecycle.Experimental
      , description = Some
          "Web UI for keiro, the event sourcing framework and workflow engine"
      , domains = [ "EventSourcing", "Workflow", "Frontend" ]
      }
    , repos =
      [ Schema.Repo::{ name = "keiro-ui", github = Some "shinzui/keiro-ui" } ]
    , okfBundles =
      [ Schema.OkfBundle::{
        , name = "adrs"
        , path = "docs/adr"
        , okfVersion = "0.2"
        , profile = Some "docs/adr/profile.dhall"
        , description = Some
            "Durable architecture decisions for the keiro runtime UI initiative"
        }
      ]
    }
