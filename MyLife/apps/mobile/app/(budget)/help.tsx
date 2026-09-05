import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BUDGET_HELP_CONTENT,
  GlassCard,
  MaterialSymbol,
  type BudgetChangelogEntry,
  type BudgetFaqEntry,
  type BudgetHelpCategory,
  type BudgetTutorialEntry,
} from '@mylife/budget';

const CATEGORY_ACCENTS = [
  BG_ACCENT_LIGHT,
  BG_MONEY,
  '#8BCFF0',
  '#A78BFA',
  '#F59E0B',
  '#F97316',
  '#FB7185',
] as const;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(
  search: string,
  category: BudgetHelpCategory,
  faqs: BudgetFaqEntry[],
  tutorials: BudgetTutorialEntry[],
): boolean {
  if (!search) {
    return true;
  }

  const haystack = [
    category.title,
    category.description,
    ...faqs.flatMap((faq) => [faq.question, faq.answer, ...faq.keywords]),
    ...tutorials.flatMap((tutorial) => [tutorial.title, tutorial.summary]),
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(search);
}

export default function HelpScreen() {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(BUDGET_HELP_CONTENT.faqs[0]?.id ?? null);
  const [expandedReleaseId, setExpandedReleaseId] = useState<string | null>(BUDGET_HELP_CONTENT.changelog[0]?.id ?? null);

  const normalizedSearch = normalize(search);

  const visibleCategories = useMemo(() => {
    return BUDGET_HELP_CONTENT.categories.filter((category) => {
      const faqs = BUDGET_HELP_CONTENT.faqs.filter((faq) => faq.categoryId === category.id);
      const tutorials = BUDGET_HELP_CONTENT.tutorials.filter(
        (tutorial) => tutorial.categoryId === category.id,
      );

      if (selectedCategoryId !== 'all' && category.id !== selectedCategoryId) {
        return false;
      }

      return matchesSearch(normalizedSearch, category, faqs, tutorials);
    });
  }, [normalizedSearch, selectedCategoryId]);

  const visibleFaqs = useMemo(() => {
    return BUDGET_HELP_CONTENT.faqs.filter((faq) => {
      if (selectedCategoryId !== 'all' && faq.categoryId !== selectedCategoryId) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        faq.question,
        faq.answer,
        ...faq.keywords,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [normalizedSearch, selectedCategoryId]);

  const visibleTutorials = useMemo(() => {
    return BUDGET_HELP_CONTENT.tutorials.filter((tutorial) => {
      if (selectedCategoryId !== 'all' && tutorial.categoryId !== selectedCategoryId) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        tutorial.title,
        tutorial.summary,
        tutorial.duration,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [normalizedSearch, selectedCategoryId]);

  const handleSupportPress = async () => {
    await Linking.openURL(`mailto:${BUDGET_HELP_CONTENT.supportEmail}?subject=MyBudget%20Support`);
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>Help Center</Text>
        <Text style={styles.heroTitle}>Get Help</Text>
        <Text style={styles.heroSubtitle}>
          Search quick answers, learn the MyBudget workflow, and review recent releases without
          leaving the app.
        </Text>
      </View>

      <GlassCard style={styles.searchCard}>
        <View style={styles.searchRow}>
          <View style={styles.searchIcon}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="search" size={18} />
          </View>
          <TextInput
            onChangeText={setSearch}
            placeholder="Search guides, FAQs, or changelog entries"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.searchInput}
            value={search}
          />
        </View>
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Guide Categories</Text>
        <Text style={styles.sectionTitle}>Start from the area you are working on</Text>
      </View>

      <View style={styles.filterRow}>
        <FilterPill
          active={selectedCategoryId === 'all'}
          label="All"
          onPress={() => setSelectedCategoryId('all')}
        />
        {BUDGET_HELP_CONTENT.categories.map((category) => (
          <FilterPill
            key={category.id}
            active={selectedCategoryId === category.id}
            label={category.title}
            onPress={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </View>

      <View style={styles.categoryGrid}>
        {visibleCategories.map((category, index) => (
          <Pressable key={category.id} onPress={() => setSelectedCategoryId(category.id)}>
            <GlassCard style={styles.categoryCard}>
              <View
                style={[
                  styles.categoryIcon,
                  { backgroundColor: `${CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length]}22` },
                ]}
              >
                <MaterialSymbol
                  color={CATEGORY_ACCENTS[index % CATEGORY_ACCENTS.length]}
                  name={category.icon}
                  size={20}
                />
              </View>
              <Text style={styles.categoryTitle}>{category.title}</Text>
              <Text style={styles.categoryDescription}>{category.description}</Text>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Popular FAQs</Text>
        <Text style={styles.sectionTitle}>Fast answers for the most common questions</Text>
      </View>

      <View style={styles.stack}>
        {visibleFaqs.slice(0, normalizedSearch ? visibleFaqs.length : 6).map((faq) => {
          const expanded = expandedFaqId === faq.id;
          return (
            <Pressable
              key={faq.id}
              onPress={() => setExpandedFaqId(expanded ? null : faq.id)}
            >
              <GlassCard style={styles.faqCard}>
                <View style={styles.faqHeader}>
                  <View style={styles.faqTitleWrap}>
                    <Text style={styles.faqTitle}>{faq.question}</Text>
                    <Text style={styles.faqMeta}>
                      {BUDGET_HELP_CONTENT.categories.find((category) => category.id === faq.categoryId)?.title}
                    </Text>
                  </View>
                  <MaterialSymbol
                    color={expanded ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
                    name={expanded ? 'arrow_downward' : 'arrow_forward'}
                    size={18}
                  />
                </View>
                {expanded ? <Text style={styles.faqAnswer}>{faq.answer}</Text> : null}
              </GlassCard>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>Tutorials</Text>
        <Text style={styles.sectionTitle}>Short guided walkthroughs</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.tutorialRail}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {visibleTutorials.map((tutorial) => (
          <GlassCard key={tutorial.id} style={styles.tutorialCard}>
            <View style={styles.tutorialIcon}>
              <MaterialSymbol color={BG_MONEY} name={tutorial.icon} size={20} />
            </View>
            <Text style={styles.tutorialDuration}>{tutorial.duration}</Text>
            <Text style={styles.tutorialTitle}>{tutorial.title}</Text>
            <Text style={styles.tutorialSummary}>{tutorial.summary}</Text>
          </GlassCard>
        ))}
      </ScrollView>

      <GlassCard style={styles.supportCard}>
        <View style={styles.supportBadge}>
          <MaterialSymbol color={BG_ACCENT_LIGHT} name="notifications" size={20} />
        </View>
        <Text style={styles.supportTitle}>Contact Support</Text>
        <Text style={styles.supportCopy}>
          Need a human? Send a message and include the screen or workflow you were using.
        </Text>
        <Pressable onPress={handleSupportPress} style={styles.supportButton}>
          <Text style={styles.supportButtonText}>Email {BUDGET_HELP_CONTENT.supportEmail}</Text>
          <MaterialSymbol color={BG_SURFACES.lowest} name="arrow_forward" size={18} />
        </Pressable>
      </GlassCard>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionEyebrow}>What&apos;s New</Text>
        <Text style={styles.sectionTitle}>Recent releases and improvements</Text>
      </View>

      <View style={styles.stack}>
        {BUDGET_HELP_CONTENT.changelog.map((release) => (
          <ReleaseCard
            key={release.id}
            expanded={expandedReleaseId === release.id}
            onPress={() =>
              setExpandedReleaseId((current) => (current === release.id ? null : release.id))
            }
            release={release}
          />
        ))}
      </View>

      {!visibleFaqs.length && !visibleCategories.length && !visibleTutorials.length ? (
        <GlassCard style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matching help content</Text>
          <Text style={styles.emptyCopy}>
            Try a broader search like &quot;budget&quot;, &quot;bank&quot;, or &quot;subscriptions&quot;.
          </Text>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

function FilterPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filterPill, active ? styles.filterPillActive : null]}
    >
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function ReleaseCard({
  expanded,
  onPress,
  release,
}: {
  expanded: boolean;
  onPress: () => void;
  release: BudgetChangelogEntry;
}) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.releaseCard}>
        <View style={styles.releaseHeader}>
          <View style={styles.releaseCopy}>
            <Text style={styles.releaseVersion}>{release.version}</Text>
            <Text style={styles.releaseTitle}>{release.title}</Text>
            <Text style={styles.releaseDate}>{release.publishedOn}</Text>
          </View>
          <MaterialSymbol
            color={expanded ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
            name={expanded ? 'arrow_downward' : 'arrow_forward'}
            size={18}
          />
        </View>
        {expanded ? (
          <View style={styles.releaseBulletList}>
            {release.bullets.map((bullet) => (
              <View key={bullet} style={styles.releaseBulletRow}>
                <View style={styles.releaseBulletDot} />
                <Text style={styles.releaseBulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 48,
    gap: 18,
  },
  heroCopy: {
    gap: 8,
    paddingTop: 6,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 15,
    lineHeight: 23,
    maxWidth: 520,
  },
  searchCard: {
    padding: 0,
    overflow: 'hidden',
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  searchInput: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    paddingVertical: 4,
  },
  sectionHeader: {
    gap: 4,
    marginTop: 4,
  },
  sectionEyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 21,
    lineHeight: 26,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterPill: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterPillActive: {
    backgroundColor: `${BG_ACCENT}26`,
  },
  filterPillText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  filterPillTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  categoryCard: {
    gap: 10,
    minHeight: 156,
    width: 160,
  },
  categoryIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  categoryTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  categoryDescription: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
  },
  stack: {
    gap: 12,
  },
  faqCard: {
    gap: 14,
  },
  faqHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  faqTitleWrap: {
    flex: 1,
    gap: 6,
  },
  faqTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  faqMeta: {
    color: BG_TEXT_MUTED,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  faqAnswer: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  tutorialRail: {
    gap: 12,
    paddingRight: 8,
  },
  tutorialCard: {
    gap: 10,
    minHeight: 182,
    width: 220,
  },
  tutorialIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tutorialDuration: {
    color: BG_TEXT_MUTED,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tutorialTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  tutorialSummary: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  supportCard: {
    backgroundColor: `${BG_ACCENT}22`,
    gap: 10,
  },
  supportBadge: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  supportTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  supportCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  supportButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  supportButtonText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  releaseCard: {
    gap: 14,
  },
  releaseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  releaseCopy: {
    flex: 1,
    gap: 4,
  },
  releaseVersion: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  releaseTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  releaseDate: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  releaseBulletList: {
    gap: 10,
  },
  releaseBulletRow: {
    flexDirection: 'row',
    gap: 10,
  },
  releaseBulletDot: {
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    height: 6,
    marginTop: 8,
    width: 6,
  },
  releaseBulletText: {
    color: BG_TEXT_SECONDARY,
    flex: 1,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
  },
  emptyState: {
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  emptyCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});
