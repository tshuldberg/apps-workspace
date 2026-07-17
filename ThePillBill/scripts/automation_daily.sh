#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <patient-id> <to-email> [extra args...]" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PYTHONPATH="$ROOT/.vendor:$ROOT/src:${PYTHONPATH:-}"

PATIENT_ID="$1"
TO_EMAIL="$2"
shift 2

python3 -m pillbill.cli automation-daily --patient-id "$PATIENT_ID" --to "$TO_EMAIL" "$@"
