#!/usr/bin/env python3
"""Verify revision-driven rebuilds in an isolated Git checkout, leaving the user's tree alone."""
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

repo = Path(__file__).resolve().parent.parent


def run(argv, cwd=None):
    return subprocess.check_output(argv, cwd=cwd, text=True).strip()


with tempfile.TemporaryDirectory(prefix='console-revision-') as tmp:
    tree = Path(tmp).resolve()
    for name in run(['git', 'ls-files'], repo).splitlines():
        if (repo / name).is_file():
            dest = tree / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(repo / name, dest)
    run(['git', 'init', '-q'], tree)
    run(['git', 'config', 'user.name', 'Console benchmark'], tree)
    run(['git', 'config', 'user.email', 'benchmark@example.invalid'], tree)
    message = ('test: verify console revision identity\n\n'
               'ExecPlan: docs/plans/21-add-native-nix-builds-and-fast-docker-images-for-the-console.md\n'
               'Intention: intention_01m5wfzzxzec4vdj0tyq8j2dpy')

    def commit():
        run(['git', 'add', '.'], tree)
        run(['git', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', message], tree)

    def identity():
        ref = 'git+file://' + str(tree)
        return {key: run(['nix', 'eval', '--raw', ref + '#console.' + key])
                for key in ['gitCommit', 'drvPath']}

    commit()
    clean = identity()
    readme = tree / 'README.md'
    readme.write_text(readme.read_text() + '\nRevision identity check.\n')
    dirty = identity()
    assert dirty['gitCommit'] == clean['gitCommit'] + '-dirty'
    assert dirty['drvPath'] != clean['drvPath']
    commit()
    docs_commit = identity()
    assert docs_commit['gitCommit'] != clean['gitCommit']
    assert docs_commit['drvPath'] not in [clean['drvPath'], dirty['drvPath']]
    print(json.dumps(dict(clean=clean, dirty=dirty, docs_commit=docs_commit), indent=2))
