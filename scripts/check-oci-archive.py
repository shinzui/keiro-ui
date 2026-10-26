#!/usr/bin/env python3
"""Validate console OCI metadata before importing it into Apple containers."""
import hashlib
import json
import io
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
    entries = {}
    for layer in manifest['layers']:
        data = archive.extractfile('blobs/' + layer['digest'].replace(':', '/')).read()
        assert hashlib.sha256(data).hexdigest() == layer['digest'].split(':', 1)[1]
        if layer['mediaType'].endswith('+gzip'):
            assert data[:2] == b'\x1f\x8b', 'OCI layer compression label does not match its bytes'
        with tarfile.open(fileobj=io.BytesIO(data), mode='r:*') as files:
            for entry in files:
                entries[entry.name.removeprefix('./').lstrip('/')] = entry
                assert 'node_modules' not in entry.name
                assert not any(part in entry.name for part in ['-console-source/', '/bin/bun', '/bin/node'])
    served = entries['srv/console'].linkname.lstrip('/')
    for name in ['index.html', 'VERSION', 'NOTICE.md', 'OFL.txt']:
        entry = entries[served + '/' + name]
        assert entry.isfile() and entry.size > 0, 'served files must be materialized in the image'
    print(json.dumps({'architecture': config['architecture'], 'layers': config['rootfs']['diff_ids'],
                      'media_types': [layer['mediaType'] for layer in manifest['layers']],
                      'blob_bytes': sum(layer['size'] for layer in manifest['layers'])}))
