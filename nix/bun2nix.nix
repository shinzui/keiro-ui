# mori://nix-community/bun2nix, programs/bun2nix/src/lib.rs (artifact URI pending).
# Release 2.1.2's decoder handles this lock's registry/workspace tuples, but its
# top-level version gate predates Bun's v2 lockfiles. Keep the original lock intact.
# The generation check and frozen sandbox installs exercise this compatibility patch.
{ bun2nix }:
bun2nix.overrideAttrs (old: {
  postPatch = (old.postPatch or "") + ''
    substituteInPlace src/lib.rs \
      --replace-fail 'if lockfile.lockfile_version != 1 {' \
        'if !matches!(lockfile.lockfile_version, 1 | 2) {'
  '';
})
