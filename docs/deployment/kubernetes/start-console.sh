#!/bin/sh
set -eu
# Configuration is mandatory in this image. There is no baked-in fake or legacy catalog.
test -s /srv/console/index.html
test -s /etc/keiro-console/Caddyfile
test -s /etc/keiro-console/console-config.json
caddy validate --config /etc/keiro-console/Caddyfile --adapter caddyfile
exec caddy run --config /etc/keiro-console/Caddyfile --adapter caddyfile
