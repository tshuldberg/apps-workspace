import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import {
  ChevronRight,
  Globe,
  Info,
  MapPin,
  Sliders,
  Truck,
  UserCircle,
} from 'lucide-react-native';
import {
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_DANGER,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { Text, colors } from '@mylife/ui';

const APP_VERSION = '1.0.0';
const ACCENT = '#22C55E';

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.sectionHeading}>
      {icon}
      <Text style={styles.sectionHeadingText}>{label}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingsRow} onPress={onPress}>
      <View style={styles.settingsIconBox}>{icon}</View>
      <View style={styles.settingsBody}>
        <Text style={styles.settingsTitle}>{title}</Text>
        {subtitle != null && (
          <Text style={styles.settingsSubtitle}>{subtitle}</Text>
        )}
      </View>
      {value != null && (
        <Text style={styles.settingsValue}>{value}</Text>
      )}
      <ChevronRight size={16} color="rgba(214, 195, 181, 0.3)" strokeWidth={2} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [zipCode, setZipCode] = useState('');
  const [defaultLocation, setDefaultLocation] = useState('');
  const [chefOrigin, setChefOrigin] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>
          Configure your BestChef experience
        </Text>
      </View>

      {/* Provider Settings */}
      <SectionHeading
        icon={<Truck size={16} color={ACCENT} strokeWidth={2} />}
        label="GROCERY DELIVERY"
      />
      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DELIVERY ZIP CODE</Text>
          <TextInput
            style={styles.fieldInput}
            value={zipCode}
            onChangeText={setZipCode}
            placeholder="Enter your zip code"
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>
        <View style={styles.divider} />
        <Text style={styles.fieldHint}>
          Used to check ingredient availability from grocery delivery providers
          in your area.
        </Text>
      </View>

      {/* Chef Defaults */}
      <SectionHeading
        icon={<UserCircle size={16} color={ACCENT} strokeWidth={2} />}
        label="CHEF DEFAULTS"
      />
      <View style={styles.card}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DEFAULT LOCATION</Text>
          <TextInput
            style={styles.fieldInput}
            value={defaultLocation}
            onChangeText={setDefaultLocation}
            placeholder="e.g. Los Angeles, CA"
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
          />
        </View>
        <View style={styles.divider} />
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CHEF ORIGIN</Text>
          <TextInput
            style={styles.fieldInput}
            value={chefOrigin}
            onChangeText={setChefOrigin}
            placeholder="e.g. Italian-American, Oaxacan"
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
          />
        </View>
      </View>

      {/* Notifications */}
      <SectionHeading
        icon={<Sliders size={16} color={ACCENT} strokeWidth={2} />}
        label="PREFERENCES"
      />
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchBody}>
            <Text style={styles.settingsTitle}>Notifications</Text>
            <Text style={styles.settingsSubtitle}>
              Get notified about votes, comments, and rankings
            </Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: RECIPES_SURFACES.highest, true: ACCENT }}
            thumbColor="#FFFFFF"
            ios_backgroundColor={RECIPES_SURFACES.highest}
          />
        </View>
      </View>

      {/* Creator Program */}
      <SectionHeading
        icon={<Globe size={16} color={ACCENT} strokeWidth={2} />}
        label="CREATOR"
      />
      <Pressable style={styles.card}>
        <SettingsRow
          icon={<Globe size={18} color={RECIPES_SECONDARY} strokeWidth={2} />}
          title="Creator Program"
          subtitle="Apply to become a verified creator"
        />
      </Pressable>

      {/* About */}
      <SectionHeading
        icon={<Info size={16} color={ACCENT} strokeWidth={2} />}
        label="ABOUT"
      />
      <View style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Version</Text>
          <Text style={styles.aboutValue}>{APP_VERSION}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Theme</Text>
          <Text style={styles.aboutValue}>Obsidian Noir</Text>
        </View>
        <View style={styles.divider} />
        <Pressable style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Privacy Policy</Text>
          <ChevronRight size={16} color="rgba(214, 195, 181, 0.3)" strokeWidth={2} />
        </Pressable>
        <View style={styles.divider} />
        <Pressable style={styles.aboutRow}>
          <Text style={styles.aboutLabel}>Terms of Service</Text>
          <ChevronRight size={16} color="rgba(214, 195, 181, 0.3)" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Version footer */}
      <Text style={styles.versionText}>
        BESTCHEF v{APP_VERSION}  {'\u2022'}  OBSIDIAN NOIR
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 64,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 30,
    color: colors.text,
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Section heading
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  sectionHeadingText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: ACCENT,
  },

  // Card
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 14,
  },

  // Field
  fieldGroup: {
    gap: 10,
  },
  fieldLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  fieldHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Switch row
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  switchBody: {
    flex: 1,
    gap: 4,
  },

  // Settings row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBody: {
    flex: 1,
    gap: 2,
  },
  settingsTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  settingsSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  settingsValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: ACCENT,
  },

  // About
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aboutLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
  },
  aboutValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Version
  versionText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 2,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});
