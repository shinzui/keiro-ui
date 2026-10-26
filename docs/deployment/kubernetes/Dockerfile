# Verified 2026-10-26 against the official Docker registry and upstream v2.11.7 tag.
FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f
# Port 8080 requires no file capability; the inherited privileged binary fails with cap-drop ALL.
RUN setcap -r /usr/bin/caddy
ARG CONSOLE_ASSETS=apps/console/dist
ARG CONSOLE_RECIPE=docs/deployment/kubernetes
COPY ${CONSOLE_ASSETS}/ /srv/console/
COPY --chmod=0555 ${CONSOLE_RECIPE}/start-console.sh /usr/local/bin/start-console
ENV XDG_DATA_HOME=/data XDG_CONFIG_HOME=/config HOME=/tmp
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/start-console"]
