import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { useMkStyles } from '../providers/AppThemeProvider';
import { type MkColors, MK_RADIUS } from '../theme/tokens';
import { ONBOARDING_EXPERIENCES } from '../data/onboarding-experience-core';
import { deviceLayoutRevision, getDeviceLayoutDefault, getLayoutDeviceClass, setDeviceLayoutDefault, setLayoutDeviceClass, subscribeDeviceLayout } from '../data/device-layout-core';

export function DeviceLayoutSection() {
  const db = useMeerkatDatabase();
  const styles = useMkStyles(makeStyles);
  useSyncExternalStore(subscribeDeviceLayout, deviceLayoutRevision, deviceLayoutRevision);
  const profile = getLayoutDeviceClass(db, 'mobile');
  const choice = getDeviceLayoutDefault(db, profile);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const save = (change: () => void) => {
    try { change(); setNotice('Device layout saved. Open a community to use it.'); }
    catch { setNotice('Could not save the device layout. Try again.'); }
  };
  return <View style={styles.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.option}>
      <Text style={styles.title}>Default layout on this device</Text>
      <Text style={styles.detail}>{profile === 'desktop' ? 'Desktop' : 'Mobile'} · {ONBOARDING_EXPERIENCES.find((item) => item.id === choice)?.name ?? 'Use community layout'} · {expanded ? 'Hide choices' : 'Change'}</Text>
    </Pressable>
    {expanded && <>
    <Text style={styles.detail}>Choose how community homes open here. Desktop and mobile keep separate defaults on this device. These settings do not sync or change anyone else’s layout.</Text>
    <Text style={styles.title}>Use settings for</Text>
    <View style={styles.row}>{(['desktop', 'mobile'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: profile === value }} onPress={() => save(() => setLayoutDeviceClass(db, value))} style={[styles.option, profile === value && styles.selected]}><Text style={styles.title}>{value === 'desktop' ? 'Desktop' : 'Mobile'}</Text></Pressable>)}</View>
    <Text style={styles.title}>Default community home</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: choice === 'community' }} onPress={() => save(() => setDeviceLayoutDefault(db, profile, 'community'))} style={[styles.option, choice === 'community' && styles.selected]}><Text style={styles.title}>Use community layout{choice === 'community' ? ' ✓' : ''}</Text></Pressable>
    {ONBOARDING_EXPERIENCES.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: choice === item.id }} onPress={() => save(() => setDeviceLayoutDefault(db, profile, item.id))} style={[styles.option, choice === item.id && styles.selected]}>
      <Text style={styles.title}>{item.name}{choice === item.id ? ' ✓' : ''}</Text>
      <Text style={styles.detail}>{item.ready ? item.reference : item.description}</Text>
    </Pressable>)}
    </>}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.detail}>{notice}</Text> : null}
  </View>;
}
const makeStyles = (c: MkColors) => StyleSheet.create({
  panel: { padding: 16, gap: 10, backgroundColor: c.surface, borderRadius: MK_RADIUS.md, borderColor: c.border, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 8 }, title: { color: c.text, fontSize: 15, fontWeight: '700' },
  detail: { color: c.textSecondary, fontSize: 13, lineHeight: 19 },
  option: { minHeight: 44, padding: 12, gap: 5, borderRadius: MK_RADIUS.sm, borderWidth: 2, borderColor: c.border },
  selected: { borderColor: c.accent, backgroundColor: c.surfaceHigh },
});
