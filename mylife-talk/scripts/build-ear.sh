#!/usr/bin/env bash
# Builds the talk-ear on-device speech helper. Requires Xcode Command Line Tools.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p bin
echo "Compiling swift/talk-ear.swift -> bin/talk-ear"
swiftc -O -swift-version 5 -o bin/talk-ear swift/talk-ear.swift
echo "Built bin/talk-ear"
