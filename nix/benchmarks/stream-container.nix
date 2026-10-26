# Internal same-payload streamed control; never required by normal image builds.
{ dockerTools, caddy }:
{ console, caddyConfig, config }:
let
  runtimeArchive = dockerTools.buildLayeredImage {
    name = "keiro-ui-console-runtime";
    tag = "fixed";
    config.Cmd = [ "${caddy}/bin/caddy" ];
    maxLayers = 2;
    compressor = "none";
  };
in (dockerTools.streamLayeredImage {
  name = "keiro-ui-console-control";
  tag = "benchmark";
  inherit config;
  fromImage = runtimeArchive;
  # mori://nixos/nixpkgs, pkgs/build-support/docker/auto-layer.nix (artifact URI pending):
  # fromImage counts base layers but does not subtract their closure automatically.
  includeStorePaths = false;
  # Materialize files in extraCommands: contents would turn them into symlinkJoin links.
  extraCommands = ''
    mkdir -p ./nix/store ./srv ./etc/caddy
    cp -a ${console} .${console}
    cp ${caddyConfig} .${caddyConfig}
    ln -s ${console}/share/keiro-ui ./srv/console
    ln -s ${caddyConfig} ./etc/caddy/Caddyfile
  '';
  maxLayers = 4;
  created = "0001-01-01T00:00:00Z";
}) // { inherit runtimeArchive; }
