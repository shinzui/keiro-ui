#!/usr/bin/env python3
"""Validate console OCI metadata before importing it into Apple containers."""
import hashlib
import json
import sys
import tarfile

with tarfile.open(sys.argv[1]) as archive:
    def blob(descriptor):
        digest = descriptor['digest']
        algorithm, value = digest.split(':', 1)
        data = archive.extractfile('blobs/' + algorithm + '/' + value).read()
        assert algorithm == 'sha256' and hashlib.sha256(data).hexdigest() == value
        assert len(data) == descriptor['size']
        return json.loads(data)
    index = json.load(archive.extractfile('index.json'))
    manifest = blob(index['manifests'][0])
    config = blob(manifest['config'])
    assert config['os'] == 'linux'
    assert config['architecture'] == (sys.argv[2] if len(sys.argv) > 2 else 'arm64')
    assert config['config']['User'] == '65532:65532'
    assert '8080/tcp' in config['config']['ExposedPorts']
    assert config['config']['Entrypoint'][0].endswith('/bin/caddy')
    assert config['config']['Cmd'] == ['run', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']
    assert config['created'].startswith('0001-01-01T00:00:00')
    print(json.dumps({'architecture': config['architecture'], 'layers': config['rootfs']['diff_ids'],
                      'blob_bytes': sum(layer['size'] for layer in manifest['layers'])}))
