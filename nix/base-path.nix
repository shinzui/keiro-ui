# Keep scripts/normalize-base-path.sh in sync. Restrict syntax before generating Caddy text.
{ lib }:
raw:
let
  stripped = lib.removeSuffix "/" (lib.removePrefix "/" raw);
  base = if stripped == "" then "/" else "/${stripped}/";
  segments = lib.splitString "/" stripped;
  valid = builtins.match "[A-Za-z0-9_./~-]*" raw != null
    && !(lib.hasInfix "//" base)
    && !(builtins.any (s: s == "." || s == "..") segments)
    && !(builtins.elem (builtins.head segments) [ "keiro" "kiroku" "pgmq" "shibuya" ]);
in
assert lib.assertMsg valid "Invalid console base path: ${raw}";
base
