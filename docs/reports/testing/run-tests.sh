#!/usr/bin/env bash
# Run from an isolated test environment. Suites reset badminton_test; do not run
# concurrently with another test runner or a developer using that database.
set -uo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.."
testing_results="$PWD/docs/reports/testing/artifacts"
mkdir -p "$testing_results"
testing_failed=0
run_check() {
  local testing_name="$1"
  shift
  "$@" > "$testing_results/$testing_name.log" 2>&1
  local testing_status=$?
  printf '%s\t%s\n' "$testing_name" "$testing_status" >> "$testing_results/exit-codes.tsv"
  if [ "$testing_status" -ne 0 ]; then testing_failed=1; fi
}
printf 'check\texit_code\n' > "$testing_results/exit-codes.tsv"
git rev-parse HEAD > "$testing_results/base-sha.txt"
git diff --stat > "$testing_results/working-tree-stat.txt"
run_check unit npm run test:unit --prefix backend -- --reporter=json --outputFile="$testing_results/unit.json"
run_check backend npm run test:coverage --prefix backend -- --reporter=default --reporter=json --outputFile.json="$testing_results/backend.json"
run_check verification npm test --prefix backend -- performance-baseline.test.ts messaging-ws-and-presence.test.ts booking-lock-order.test.ts bracketGenerator.test.ts validation-boundaries.test.ts --reporter=json --outputFile="$testing_results/verification.json"
run_check ui env PLAYWRIGHT_JSON_OUTPUT_NAME="$testing_results/ui.json" npm run test:e2e --prefix frontend -- --config playwright.sign-in.config.ts --reporter=json --output="$testing_results/ui-results"
run_check system env PLAYWRIGHT_JSON_OUTPUT_NAME="$testing_results/system.json" npm run test:e2e --prefix frontend -- --config playwright.core.config.ts --reporter=json --output="$testing_results/system-results"
run_check remaining env PLAYWRIGHT_JSON_OUTPUT_NAME="$testing_results/remaining.json" npm run test:e2e --prefix frontend -- --config playwright.remaining.config.ts --reporter=json --output="$testing_results/remaining-results"
run_check tournament env PLAYWRIGHT_JSON_OUTPUT_NAME="$testing_results/tournament.json" npm run test:e2e:tournament --prefix frontend -- --reporter=json --output="$testing_results/tournament-results"
run_check evidence node docs/reports/testing/verify-evidence.cjs
node docs/reports/testing/summarize.cjs > "$testing_results/summary.log"
exit "$testing_failed"
