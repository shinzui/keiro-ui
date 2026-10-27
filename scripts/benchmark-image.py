#!/usr/bin/env python3
"""Compare fresh source builds, metadata assembly and import, retaining phase logs."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import statistics
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rebuild-importer', action='store_true', help='Time helper compilation with cached dependencies, without deleting caches')
parser.add_argument('--output', type=Path, default=Path('.dev/image-benchmark'))
args = parser.parse_args()
repo = Path(__file__).resolve().parent.parent
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
coordinator = os.environ.get('APPLE_NIX_CONTAINER')
if os.uname().sysname == 'Darwin' and not coordinator:
    parser.error('macOS benchmarks require Apple Container: set APPLE_NIX_CONTAINER and APPLE_NIX_EXCHANGE')
exchange = Path(os.environ['APPLE_NIX_EXCHANGE']).resolve() if coordinator else None
prefix = ['container', 'exec', coordinator] if coordinator else []
linux_repo = '/workspace' if coordinator else str(repo)
rows = []
layer_evidence = {}
nonce = secrets.token_hex(4)


def run(argv, label=None):
    start = time.monotonic()
    proc = subprocess.run(argv, text=True, capture_output=True)
    elapsed = time.monotonic() - start
    if label:
        (out / (label + '.log')).write_text(proc.stderr + proc.stdout)
    if proc.returncode:
        raise RuntimeError(shlex.join(argv) + '\n' + proc.stderr)
    return proc.stdout, elapsed


def nix(*argv, label=None):
    return run(prefix + ['nix', '--extra-experimental-features', 'nix-command flakes', *argv], label)


with tempfile.TemporaryDirectory(prefix='image-benchmark-', dir=exchange) as tmp:
    tree = Path(tmp).resolve() / 'source'
    tree.mkdir()
    linux_source = '/exchange/' + tree.parent.name + '/source' if coordinator else str(tree)
    for name in run(['git', 'ls-files', '-z'], label=None)[0].split('\0'):
        if name and (repo / name).is_file():
            dest = tree / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / name, dest)
    expr = ('let f = builtins.getFlake ' + json.dumps("git+file://" + linux_repo) + '; in import '
            + linux_repo + '/nix/image-benchmark.nix { flake = f; sourceRoot = /. + '
            + json.dumps(linux_source) + '; }')

    def build(attr, label):
        stdout, elapsed = nix('build', '--impure', '--json', '--no-link', '--option', 'sandbox', 'true',
                              '-L', '--expr', '(' + expr + ').' + attr, label=label)
        return json.loads(stdout)[0]['outputs']['out'], elapsed

    def identities():
        return json.loads(nix('eval', '--impure', '--json', '--expr', '(' + expr + ').identities')[0])

    # Preserve actual initial cache state. First importer realization includes patched Skopeo.
    initial_ids = identities()
    initial_console, first_app = build('console', 'first-application')
    initial_image, first_assembly = build('image', 'first-assembly')
    importer_attr = 'image.copyTo' if coordinator else 'image.copyToDockerDaemon'
    importer, first_helper = build(importer_attr, 'first-importer-realization')
    importer += '/bin/copy-to' if coordinator else '/bin/copy-to-docker-daemon'
    importer_rebuild_s = None
    if args.rebuild_importer:
        # A new probe derivation measures compilation without pruning caches or requiring
        # byte-identical helper binaries (upstream Skopeo fails nix --rebuild comparison).
        probe_expr = '(' + expr + ').skopeo.overrideAttrs (_: { pname = "skopeo-probe-' + nonce + '"; })'
        _, importer_rebuild_s = nix('build', '--impure', '--no-link', '--option', 'sandbox', 'true',
                                   '-L', '--expr', probe_expr, label='importer-probe-cached-dependencies')
    control, first_control = build('control', 'first-control-realization')
    skopeo = None
    if coordinator:
        skopeo, skopeo_prepare = build('skopeo', 'apple-conversion-tool')

    def import_image(builder, program, label):
        if not coordinator:
            if builder == 'nix2container':
                return run([program], label)[1]
            # Streaming overlaps generation and load: time this pipeline exactly once.
            return run(['bash', '-o', 'pipefail', '-c', shlex.quote(program) + ' | docker load'], label)[1]
        archive = '/exchange/' + tree.parent.name + '/' + label + '.oci.tar'
        host_archive = tree.parent / (label + '.oci.tar')
        if builder == 'nix2container':
            export_command = shlex.quote(program) + ' --format oci ' + shlex.quote(
                'oci-archive:' + archive + ':keiro-ui-console:benchmark')
        else:
            # Apple accepts OCI archives, not Docker archives. Include conversion in elapsed time.
            docker_archive = archive + '.docker'
            export_command = (shlex.quote(program) + ' > ' + shlex.quote(docker_archive) + ' && '
                              + shlex.quote(skopeo + '/bin/skopeo') + ' --insecure-policy copy '
                              + '--format oci '
                              + shlex.quote('docker-archive:' + docker_archive) + ' '
                              + shlex.quote('oci-archive:' + archive + ':keiro-ui-console-control:benchmark'))
        _, export_s = run(prefix + ['sh', '-c', export_command], label + '-export')
        metadata = json.loads(run(['python3', str(repo / 'scripts/check-oci-archive.py'), str(host_archive)], label + '-metadata')[0])
        assert all(kind.endswith('.tar+gzip') for kind in metadata['media_types']), 'both Apple exports use the same default OCI compression'
        layer_evidence[label] = metadata
        stable_count = 1 if builder == 'nix2container' else 2
        previous = layer_evidence.get('first-import' if builder == 'nix2container' else 'first-control-import')
        if label.startswith('edit-'):
            assert metadata['layers'][:stable_count] == previous['layers'][:stable_count]
            assert metadata['layers'][stable_count:] != previous['layers'][stable_count:]
        _, load_s = run(['container', 'image', 'load', '--input', str(host_archive)], label + '-load')
        return export_s + load_s

    first_import = import_image('nix2container', importer, 'first-import')
    import_image('dockerTools', control, 'first-control-import')
    for sample in range(3):
        ui = tree / 'apps/console/src/routes/_shell/index.tsx'
        original = (repo / 'apps/console/src/routes/_shell/index.tsx').read_text()
        ui.write_text(original.replace('title="Overview"', f'title="Overview image {nonce} sample {sample}"'))
        current_ids = identities()
        assert current_ids['console'] != initial_ids['console']
        assert current_ids['cache'] == initial_ids['cache']
        assert current_ids['runtime'] == initial_ids['runtime']
        console, app_s = build('console', f'edit-{sample}-application')
        assert 'keiro-timing vite_ms=' in (out / f'edit-{sample}-application.log').read_text(), 'source sample was already realized'
        for builder in (['nix2container', 'dockerTools'] if sample % 2 == 0 else ['dockerTools', 'nix2container']):
            label = f'edit-{sample}-{builder}'
            # Both builders consume this single realized console derivation.
            # One Nix evaluation per builder: realizing the importer also assembles its image.
            attr = importer_attr if builder == 'nix2container' else 'control'
            artifact, assembly_s = build(attr, label + '-assembly')
            program = artifact
            if builder == 'nix2container':
                program += '/bin/copy-to' if coordinator else '/bin/copy-to-docker-daemon'
            inspect = (['container', 'image', 'inspect', ('keiro-ui-console:benchmark' if builder == 'nix2container' else 'keiro-ui-console-control:benchmark')] if coordinator
                       else ['docker', 'image', 'inspect', ('keiro-ui-console:benchmark' if builder == 'nix2container' else 'keiro-ui-console-control:benchmark')])
            state = run(inspect, label + '-existing-layer-state')[0]
            import_s = import_image(builder, program, label)
            rows.append(dict(sample=sample, builder=builder, console=console, identities=current_ids,
                             app_s=app_s, assembly_s=assembly_s, import_s=import_s,
                             assembly_import_s=assembly_s + import_s,
                             total_s=app_s + assembly_s + import_s))
    # Cache-hit repeat is kept separate from changed-content measurements.
    _, unchanged_s = build('console', 'unchanged-repeat')
    env = os.environ.copy()
    env['CONSOLE_EXPECTED_OVERVIEW'] = f'Overview image {nonce} sample 2'
    env['CONTAINER_RUNTIME'] = 'apple' if coordinator else 'docker'
    for reference in ['keiro-ui-console:benchmark', 'keiro-ui-console-control:benchmark']:
        smoke = subprocess.run(['bash', str(repo / 'scripts/check-container.sh'), reference, '/'],
                               env=env, text=True, capture_output=True)
        (out / ('changed-content-browser-' + reference.split(':')[0] + '.log')).write_text(smoke.stdout + smoke.stderr)
        if smoke.returncode:
            raise RuntimeError(smoke.stdout + smoke.stderr)
    metadata = run((['container', 'image', 'inspect'] if coordinator else ['docker', 'image', 'inspect'])
                   + ['keiro-ui-console:benchmark'], 'final-image-metadata')[0]
    report = dict(runtime='apple' if coordinator else 'docker',
                  host=run(['uname', '-a'])[0].strip(),
                  linux=run(prefix + ['uname', '-a'])[0].strip(),
                  nix=nix('--version')[0].strip(),
                  runtime_version=run(['container' if coordinator else 'docker', '--version'])[0].strip(),
                  initial_cache_state='No caches or images pruned; initial realization work is retained in first-*.log',
                  initial_application_built='keiro-timing vite_ms=' in (out / 'first-application.log').read_text(),
                  source_nonce=nonce, importer_rebuild_cached_dependencies_s=importer_rebuild_s,
                  initial_run=dict(app_s=first_app, assembly_s=first_assembly,
                                 importer_realization_s=first_helper, import_s=first_import,
                                 control_realization_s=first_control),
                  unchanged_app_s=unchanged_s, samples=rows,
                  medians={builder: {key: statistics.median(r[key] for r in rows if r['builder'] == builder)
                                     for key in ['app_s', 'assembly_s', 'import_s', 'assembly_import_s', 'total_s']}
                           for builder in ['nix2container', 'dockerTools']},
                  layer_evidence=layer_evidence, final_image=json.loads(metadata))
    (out / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
