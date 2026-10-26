{ lib, writeText, runCommand, caddy }:
{ basePath, root ? "/srv/console", port ? "8080" }:
let
  base = import ./base-path.nix { inherit lib; } basePath;
  # basePath is restricted to literal path characters; JSON quotes escape Caddy strings.
  quote = builtins.toJSON;
  static = ''
    root * ${quote root}
    handle /console-config.json {
      header Cache-Control "no-store"
      file_server
    }
    handle /assets/* {
      header Cache-Control "public, max-age=31536000, immutable"
      file_server
    }
    handle {
      header Cache-Control "no-cache"
      try_files {path} /index.html
      file_server
    }
  '';
  text = ''
    {
      admin off
      auto_https off
      persist_config off
    }
    :${port} {
      log {
        output stdout
      }
      @inspection path /kiroku /kiroku/* /shibuya /shibuya/* /pgmq /pgmq/* /keiro /keiro/*
      handle @inspection {
        respond "Inspection surface not configured" 404
      }
      ${lib.optionalString (base != "/") ''
        redir ${quote (lib.removeSuffix "/" base)} ${quote base} 308
      ''}
      ${if base == "/" then "handle" else "handle_path ${quote (base + "*")}"} {
        ${static}
      }
      ${lib.optionalString (base != "/") ''
        handle {
          respond "Not found" 404
        }
      ''}
    }
  '';
  config = writeText "console-Caddyfile" text;
in runCommand "console-Caddyfile-validated" { nativeBuildInputs = [ caddy ]; } ''
  cp ${config} $out
  chmod u+w $out
  caddy fmt --overwrite $out
  caddy validate --config $out --adapter caddyfile
''
