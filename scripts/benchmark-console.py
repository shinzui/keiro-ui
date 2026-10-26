#!/usr/bin/env python3
"""Measure fresh source builds and check cache identities without editing the checkout."""
import argparse
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import statistics
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--output', required=True, type=Path, help='Keep logs and JSON evidence here')
args = parser.parse_args()
nonce = secrets.token_hex(4)
repo = Path(__file__).resolve().parent.parent
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)


def run(argv, **kwargs):
    result = subprocess.run(argv, text=True, capture_output=True, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result


def expression(source, reuse=False):
    return ('let f = builtins.getFlake ' + json.dumps("git+file://" + str(repo)) + '; in import '
            + '( /. + ' + json.dumps(str(source / 'nix/image-benchmark.nix')) + ')'  + ' { flake = f; sourceRoot = /. + '
            + json.dumps(str(source)) + '; reuseNodeModules = ' + str(reuse).lower() + '; }')


def identities(source):
    return json.loads(run(['nix', 'eval', '--impure', '--json', '--expr',
                           '(' + expression(source) + ').identities']).stdout)


def build(source, reuse, label):
    start = time.monotonic()
    proc = run(['nix', 'build', '--impure', '--no-link', '--json', '--option', 'sandbox', 'true',
                '-L', '--expr', '(' + expression(source, reuse) + ').console'])
    elapsed = time.monotonic() - start
    (out / (label + '.log')).write_text(proc.stderr)
    if label.startswith('edit-'):
        assert 'keiro-timing vite_ms=' in proc.stderr, 'source sample was already realized'
    phases = {key: int(value) for key, value in re.findall(r'keiro-timing (\w+)=(\d+)', proc.stderr)}
    return dict(label=label, reuse=reuse, elapsed_s=elapsed, phases_ms=phases,
                output=json.loads(proc.stdout)[0]['outputs']['out'])


with tempfile.TemporaryDirectory(prefix='keiro-console-benchmark-') as tmp:
    source = Path(tmp).resolve()
    for name in run(['git', '-c', 'safe.directory=' + str(repo), 'ls-files', '-z'], cwd=repo).stdout.split('\0'):
        if name and (repo / name).is_file():
            dst = source / name
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / name, dst)
    baseline = identities(source)
    document = source / 'README.md'
    document.write_text(document.read_text() + '\nBenchmark excluded document.\n')
    assert identities(source) == baseline, 'an excluded document changed a derivation'
    manifest = source / 'package.json'
    os.utime(manifest, None)
    assert identities(source) == baseline, 'timestamps changed derivation identity'
    ui = source / 'apps/console/src/routes/_shell/index.tsx'
    original = ui.read_text()
    ui.write_text(original.replace('title="Overview"', 'title="Overview identity check"'))
    edited = identities(source)
    assert edited['console'] != baseline['console']
    for key in ['cache', 'nodeModules', 'runtime']:
        assert edited[key] == baseline[key], key + ' changed after UI edit'
    ui.write_text(original)
    shared = source / 'packages/ui/src/components/button.tsx'
    before = shared.read_text()
    shared.write_text(before.replace('data-slot="button"', 'data-slot="button" data-benchmark="shared-edit"'))
    assert shared.read_text() != before
    shared_ids = identities(source)
    assert shared_ids['console'] != baseline['console']
    assert shared_ids['cache'] == baseline['cache']
    assert shared_ids['nodeModules'] == baseline['nodeModules']
    shared.write_text(before)
    # Change a valid locked registry integrity value without fetching it.
    lock = source / 'bun.lock'
    before_lock = lock.read_text()
    changed_lock = re.sub(r'sha512-(.)', lambda m: 'sha512-' + ('A' if m[1] != 'A' else 'B'), before_lock, count=1)
    lock.write_text(changed_lock)
    # The generated fetch expression is the cache's source of truth; regeneration must change it.
    run(['nix', 'run', str(repo) + '#bun2nix', '--', '--lock-file', str(lock),
         '--output-file', str(source / 'bun-deps.nix')])
    assert identities(source)['cache'] != baseline['cache'], 'locked dependency did not invalidate cache'
    lock.write_text(before_lock)
    shutil.copy2(repo / 'bun-deps.nix', source / 'bun-deps.nix')
    config_path = source / 'nix/caddy-config.nix'
    config_before = config_path.read_text()
    config_path.write_text(config_before.replace('31536000', '31536001'))
    config_ids = identities(source)
    assert config_ids['console'] == baseline['console'], 'image-only edit rebuilt console'
    assert config_ids['image'] != baseline['image'], 'image-only edit did not change image'
    config_path.write_text(config_before)
    rows = []
    # First use realizes the reusable installed tree; report separately from warm edits.
    rows.append(build(source, True, 'first-reusable-install'))
    for sample in range(3):
        ui.write_text(original.replace('title="Overview"', f'title="Overview benchmark {nonce} {sample}"'))
        for reuse in ([False, True] if sample % 2 == 0 else [True, False]):
            rows.append(build(source, reuse, f'edit-{sample}-' + ('restore' if reuse else 'install')))
    rows.append(build(source, False, 'unchanged-repeat'))
    report = dict(host=run(['uname', '-a']).stdout.strip(), nix=run(['nix', '--version']).stdout.strip(),
                  source_nonce=nonce, baseline=baseline, ui_edit=edited, shared_edit=shared_ids, config_edit=config_ids, samples=rows,
                  medians_s={str(reuse): statistics.median(r['elapsed_s'] for r in rows
                              if r['label'].startswith('edit-') and r['reuse'] == reuse)
                             for reuse in [False, True]})
    (out / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
