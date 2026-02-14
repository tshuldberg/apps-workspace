import React from 'react'
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, fontSize } from '../../constants/theme'

interface SettingsItem {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  onPress?: () => void
  trailing?: string
}

const SECTIONS: { title: string; items: SettingsItem[] }[] = [
  {
    title: 'Account',
    items: [
      { icon: 'person-outline', label: 'Profile' },
      { icon: 'card-outline', label: 'Subscription', trailing: 'Free' },
      { icon: 'shield-checkmark-outline', label: 'Security' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: 'color-palette-outline', label: 'Appearance', trailing: 'Dark' },
      { icon: 'notifications-outline', label: 'Notifications' },
      { icon: 'time-outline', label: 'Default Timeframe', trailing: 'Daily' },
      { icon: 'bar-chart-outline', label: 'Chart Settings' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: 'help-circle-outline', label: 'Help Center' },
      { icon: 'chatbubble-outline', label: 'Contact Us' },
      { icon: 'document-text-outline', label: 'Terms of Service' },
      { icon: 'lock-closed-outline', label: 'Privacy Policy' },
    ],
  },
  {
    title: '',
    items: [
      { icon: 'information-circle-outline', label: 'About', trailing: 'v0.0.1' },
    ],
  },
]

export default function MoreScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {SECTIONS.map((section, si) => (
        <View key={si} style={styles.section}>
          {section.title ? (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          ) : null}
          <View style={styles.sectionCard}>
            {section.items.map((item, ii) => (
              <TouchableOpacity
                key={ii}
                style={[
                  styles.row,
                  ii < section.items.length - 1 && styles.rowBorder,
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <Ionicons name={item.icon} size={20} color={colors.textSecondary} />
                  <Text style={styles.rowLabel}>{item.label}</Text>
                </View>
                <View style={styles.rowRight}>
                  {item.trailing && (
                    <Text style={styles.rowTrailing}>{item.trailing}</Text>
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={colors.textMuted}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>TheMarlinTraders v0.0.1</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyBlack,
  },
  content: {
    paddingBottom: 40,
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    backgroundColor: colors.navyDark,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowTrailing: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },
  logoutButton: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.tradingRed,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.tradingRed,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
})
