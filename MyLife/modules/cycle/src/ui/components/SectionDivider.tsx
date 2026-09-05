import { View } from 'react-native';

interface SectionDividerProps {
  /** Height in pixels (default 32) — visual breathing room between sections. */
  size?: number;
}

/**
 * Invisible vertical spacer used between sections.
 * Enforces the MyCycle "no-line rule" — no 1px borders used for sectioning.
 */
export function SectionDivider({ size = 32 }: SectionDividerProps) {
  return <View style={{ height: size }} />;
}
