// App entry (Plan 42 P5, NC-42.7 boot-order fix).
//
// Expo requires TaskManager.defineTask to run at module scope in a JS module
// that is required EARLY, before React mounts, because a headless OS launch
// (scheduled background fetch, or a data push while the app is terminated) boots
// the JS bundle and looks up the task by name with no React view mounted. This
// entry imports the task-definitions module FIRST, for its side effect (which
// defines both background tasks at import time), and only THEN hands off to
// expo-router's normal entry. Reordering these two lines would reintroduce the
// NC-42.7 bug, so the import must stay above the expo-router entry.
//
// This file is the `main` entry (see package.json). Keep it side-effect-first.
require('./app/(root)/data/background-task-definitions');
require('expo-router/entry');
