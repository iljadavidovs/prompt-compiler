#!/usr/bin/env bash
set -euo pipefail

# Archive a committed revision: never send a home, .git, dirty files or caches.
root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
revision=$(git -C "$root" rev-parse "${1:-HEAD}^{commit}")
image="pcr-verify:${revision:0:12}"
workspace=$(mktemp -d "${TMPDIR:-/tmp}/pcr-verify.XXXXXX")
trap 'rm -rf "$workspace"' EXIT
archive="$workspace/source.tar"
git -C "$root" archive --format=tar "$revision" > "$archive"
echo "Verifying source revision $revision"
echo "Source archive bytes: $(wc -c < "$archive")"
test "$(wc -c < "$archive")" -lt 50000000
# No build cache: each invocation performs a fresh frozen dependency install.
mkdir "$workspace/source"
tar -xf "$archive" -C "$workspace/source"
docker build --no-cache -f "$workspace/source/scripts/linux/Dockerfile" -t "$image" "$workspace/source"
# The compiled application must work with all external networking disabled.
docker run --rm --network none "$image"
