#!/usr/bin/env bash
# Global coverage thresholds miss the case that matters most for agent-authored
# changes: a large uncovered addition to an otherwise well-covered codebase
# barely moves the global number. This checks only the lines a diff adds.
set -euo pipefail

base="${1:-}"
lcov="${2:-backend/coverage/lcov.info}"
threshold="${3:-80}"
prefix="backend/src/"

if [[ -z "$base" ]]; then
  echo "usage: patch-coverage.sh <base-ref> [lcov-path] [threshold]" >&2
  exit 2
fi

# lcov records paths relative to the workspace jest ran in ("src/app.ts"), while
# git reports them from the repo root ("backend/src/app.ts"). Normalising the
# two is what makes them comparable at all.
workspace="$(dirname "$(dirname "$lcov")")"

git diff --unified=0 --diff-filter=AM "$base...HEAD" -- "$prefix" |
  awk -v workspace="$workspace" -v threshold="$threshold" -v prefix="$prefix" '
    # First file: lcov. Record hit counts keyed by "file:line".
    FNR == NR {
      if (substr($0, 1, 3) == "SF:") {
        file = substr($0, 4)
        sub(/\r$/, "", file)
        if (substr(file, 1, 1) != "/") file = workspace "/" file
      } else if (substr($0, 1, 3) == "DA:" && file != "") {
        split(substr($0, 4), da, ",")
        hits[file ":" da[1]] = da[2]
      }
      next
    }

    # Second input: the diff. Track which file each hunk belongs to.
    substr($0, 1, 6) == "+++ b/" { current = substr($0, 7); next }

    # Hunk header: @@ -old +start,count @@
    substr($0, 1, 3) == "@@ " {
      match($0, /\+[0-9]+(,[0-9]+)?/)
      n = split(substr($0, RSTART + 1, RLENGTH - 1), range, ",")
      start = range[1]
      count = (n > 1) ? range[2] : 1
      for (i = 0; i < count; i++) {
        key = current ":" (start + i)
        # Absent from lcov means not an executable line (blank, comment, type).
        if (key in hits) {
          total++
          if (hits[key] > 0) covered++
          else misses[++missed] = key
        }
      }
    }

    END {
      if (total == 0) {
        print "Patch coverage: no executable lines changed under " prefix
        exit 0
      }

      pct = covered * 100 / total
      printf "Patch coverage: %d/%d lines (%.1f%%), threshold %d%%\n", covered, total, pct, threshold

      if (missed > 0) {
        print ""
        print "Uncovered lines added by this change:"
        for (i = 1; i <= missed; i++) print "  " misses[i]
      }

      if (pct < threshold) {
        printf "\nPatch coverage %.1f%% is below the %d%% threshold.\n", pct, threshold > "/dev/stderr"
        exit 1
      }
    }
  ' "$lcov" -
