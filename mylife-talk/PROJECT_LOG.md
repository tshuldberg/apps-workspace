# MyTalk Project Log

| Date | Change |
|------|--------|
| 2026-08-01 | Fix: founder-reported "nothing happens when I speak" root-caused live — AEC (voice-processing IO) reshapes mic input to 48kHz x9 which SFSpeechRecognizer cannot consume. AEC now opt-in; daemon mutes the ear during TTS + ttsMuteTailMs tail instead. Verified live (partials + final). Feature: conversation transcripts saved live to ~/.config/mylife-talk/transcripts/*.jsonl with cross-session history seeding (historyTurns). 126 tests green. |
| 2026-08-01 | Project created. Design session (companion daemon, codex brain, macOS-native speech, all interaction modes in settings), spec + plan authored, TS core implemented via codex per plan, Swift talk-ear helper (on-device STT, silence segmentation, PTT event tap, fixture mode) built and verified, Fable review pass, tests + typecheck green. |
