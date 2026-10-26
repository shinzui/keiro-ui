{ lib, runCommand, caddy, callPackage, nix2container }:
{ console, tag ? "dev", name ? "keiro-ui-console" }:
let
  caddyConfig = callPackage ./caddy-config.nix { } { inherit (console) basePath; };
  runtimeLayer = nix2container.buildLayer { deps = [ caddy ]; };
  root = runCommand "console-container-root" { } ''
    mkdir -p $out/srv $out/etc/caddy
    ln -s ${console}/share/keiro-ui $out/srv/console
    ln -s ${caddyConfig} $out/etc/caddy/Caddyfile
  '';
  config = {
    User = "65532:65532";
    ExposedPorts."8080/tcp" = { };
    Entrypoint = [ "${caddy}/bin/caddy" ];
    Cmd = [ "run" "--config" "/etc/caddy/Caddyfile" "--adapter" "caddyfile" ];
  };
  image = nix2container.buildImage {
    inherit name tag config;
    layers = [ runtimeLayer ];
    copyToRoot = root;
    maxLayers = 1;
  };
  extra = { inherit console caddyConfig runtimeLayer root config; };
in image // extra // { passthru = image.passthru // extra; }
