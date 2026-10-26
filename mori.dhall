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
        , name = "friction-log"
        , path = "docs/friction-log"
        , okfVersion = "0.2"
        , profile = Some "docs/friction-log/profile.dhall"
        , description = Some "Friction met while implementing plans, before triage into bug reports and requests"
        }
      , Schema.OkfBundle::{
        , name = "adrs"
        , path = "docs/adr"
        , okfVersion = "0.2"
        , profile = Some "docs/adr/profile.dhall"
        , description = Some
            "Durable architecture decisions for the keiro runtime UI initiative"
        }
      , Schema.OkfBundle::{
        , name = "user-documentation"
        , path = "docs/user"
        , profile = Some "mori/user-documentation-profile.dhall"
        , profileBinding = Some
            ( Schema.ProfileBinding.Published
                Schema.PinnedImport::{
                , publisher = "shinzui/okf-profiles"
                , publisherRef = Some
                    Schema.MoriRef::{ namespace = "shinzui", name = "okf-profiles" }
                , export = Some "documentation.userDocumentation"
                , version = Some "v0.19.0"
                , pin = Some
                    "sha256:85176d78369b6d73c9f13c30277903b629d6bf048a4c7d71fc26e68b99c3eaa6"
                }
            )
        , okfVersion = "0.2"
        , description = Some
            "Reader-facing documentation for running and deploying the keiro runtime console"
        }
      , Schema.OkfBundle::{
        , name = "capabilities"
        , path = "docs/capabilities"
        , profile = Some "docs/capabilities/profile.dhall"
        , okfVersion = "0.2"
        , description = Some
            "What keiro-ui provides today, one concept per capability, with evidence"
        }
      ]
    }
