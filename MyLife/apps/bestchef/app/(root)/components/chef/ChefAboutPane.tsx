import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Calendar, ExternalLink, MapPin } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { Card } from '@mylife/bestchef/ui';
import { JAKARTA_FONTS, getAllBadgesForChef } from '@mylife/bestchef';
import type { ChefBadgeDisplay } from '@mylife/bestchef';
import { useAppThemeColors as useThemeColors } from '../../providers/AppThemeProvider';
import { useBestChefCloud } from '../../providers/BestChefCloudProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { localizedBadgeName } from '../../i18n/badge-labels';

interface ChefAboutData {
  displayName: string;
  bio?: string | null;
  activeSince?: string | null;
  region?: string | null;
  isRestaurant?: boolean;
  restaurantUrl?: string | null;
}

interface Props {
  chef: ChefAboutData;
  chefId: string;
}

export function ChefAboutPane({ chef, chefId }: Props) {
  const tc = useThemeColors();
  const { t, language } = useI18n();
  const { supabase } = useBestChefCloud();
  const [badges, setBadges] = useState<ChefBadgeDisplay[]>([]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    void getAllBadgesForChef(supabase, chefId).then((result) => {
      if (!cancelled && result.ok) {
        setBadges(result.data.filter((b) => b.earned));
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [chefId, supabase]);

  const joinedLabel = chef.activeSince
    ? t('Joined {month}', { month: new Date(chef.activeSince).toLocaleDateString(language, { month: 'long', year: 'numeric' }) })
    : null;

  return (
    <View style={styles.container}>
      {/* Bio */}
      {chef.bio ? (
        <Card>
          <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Bio')}</Text>
          <Text style={[styles.bioText, { color: tc.textSecondary }]}>{chef.bio}</Text>
        </Card>
      ) : null}

      {/* Info rows */}
      <Card>
        {chef.region ? (
          <View style={styles.infoRow}>
            <MapPin size={14} color={tc.accent ?? '#22C55E'} strokeWidth={2} />
            <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('Location')}</Text>
            <Text style={[styles.infoValue, { color: tc.text }]}>{chef.region}</Text>
          </View>
        ) : null}

        {joinedLabel ? (
          <View style={[styles.infoRow, chef.region ? styles.infoRowBorder : undefined, { borderColor: tc.border ?? 'rgba(255,255,255,0.06)' }]}>
            <Calendar size={14} color={tc.accent ?? '#22C55E'} strokeWidth={2} />
            <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('Joined {month}', { month: '' }).trim()}</Text>
            <Text style={[styles.infoValue, { color: tc.text }]}>{joinedLabel}</Text>
          </View>
        ) : null}

        {chef.isRestaurant && chef.restaurantUrl ? (
          <View style={[styles.infoRow, styles.infoRowBorder, { borderColor: tc.border ?? 'rgba(255,255,255,0.06)' }]}>
            <ExternalLink size={14} color={tc.accent ?? '#22C55E'} strokeWidth={2} />
            <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('Verified restaurant')}</Text>
            <Text
              style={[styles.infoValue, styles.link, { color: tc.accent ?? '#22C55E' }]}
              onPress={() => void Linking.openURL(chef.restaurantUrl!)}
            >
              {t('View')}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* Badges */}
      {badges.length > 0 && (
        <Card>
          <Text style={[styles.sectionLabel, { color: tc.text }]}>{t('Badges')}</Text>
          <View style={styles.badgeWrap}>
            {badges.map((badge) => (
              <View key={badge.id} style={[styles.badgePill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={styles.badgeIcon}>{badge.icon}</Text>
                <Text style={[styles.badgeName, { color: tc.text }]}>{localizedBadgeName(t, badge.id, badge.name)}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  sectionLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    marginBottom: 8,
  },
  bioText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  infoRowBorder: {
    borderTopWidth: 1,
  },
  infoLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
  },
  link: {
    textDecorationLine: 'underline',
  },
  badgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeIcon: {
    fontSize: 14,
  },
  badgeName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
  },
});
