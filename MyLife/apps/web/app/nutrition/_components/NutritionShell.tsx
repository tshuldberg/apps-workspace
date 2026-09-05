'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NUTRITION_PRIMARY_NAV, NUTRITION_SECONDARY_NAV, buildNutritionThemeStyle } from '../_lib/design';
import { MaterialSymbol, NutritionButton } from './NutritionPrimitives';
import styles from './nutrition-shell.module.css';

function isActive(pathname: string, href: string): boolean {
  if (href === '/nutrition') {
    return pathname === '/nutrition';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRouteTitle(pathname: string): string {
  const item = [...NUTRITION_PRIMARY_NAV, ...NUTRITION_SECONDARY_NAV].find((entry) => isActive(pathname, entry.href));
  if (item) return item.title;

  if (pathname.startsWith('/nutrition/food/')) {
    return 'Food Detail';
  }

  return 'Daily Mission Control';
}

export function NutritionShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const routeTitle = getRouteTitle(pathname);
  const themeStyle = buildNutritionThemeStyle();

  return (
    <section className={styles.shell} style={themeStyle}>
      <aside className={styles.sidebar}>
        <Link href="/nutrition" className={styles.brand}>
          <span className={styles.brandTitle}>MyNutrition</span>
          <span className={styles.brandSubtitle}>Digital Curator</span>
        </Link>

        <div className={styles.navBlock}>
          <div className={styles.navLabel}>Primary</div>
          <nav className={styles.navList}>
            {NUTRITION_PRIMARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                >
                  <MaterialSymbol name={item.icon} filled={active} size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.navBlock}>
          <div className={styles.navLabel}>Studio</div>
          <nav className={styles.navList}>
            {NUTRITION_SECONDARY_NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ''}`}
                >
                  <MaterialSymbol name={item.icon} filled={active} size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <Link href="/nutrition/log">
            <NutritionButton tone="accent" style={{ width: '100%' }}>
              Log Food
            </NutritionButton>
          </Link>

          <div className={styles.footerCard}>
            <div className={styles.footerTitle}>This Week</div>
            <div className={styles.footerBody}>
              Keep the gold chrome for navigation and the orange accent reserved for calorie semantics.
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.appRail}>
        <div className={styles.headerWrap}>
          <header className={styles.header}>
            <div className={styles.headerTitleWrap}>
              <div className={styles.headerEyebrow}>MyNutrition</div>
              <div className={styles.headerTitle}>{routeTitle}</div>
            </div>

            <div className={styles.headerActions}>
              <Link href="/nutrition/log">
                <NutritionButton tone="calorie">Add Food</NutritionButton>
              </Link>

              <button type="button" className={styles.iconButton} aria-label="Notifications">
                <MaterialSymbol name="notifications" size={20} />
                <span className={styles.notificationDot} />
              </button>

              <div className={styles.avatar}>
                <div className={styles.avatarChip}>
                  <MaterialSymbol name="nutrition" filled size={18} />
                </div>
                <span className={styles.avatarLabel}>Curator</span>
              </div>
            </div>
          </header>

          <div className={styles.mobileLinks}>
            {[...NUTRITION_PRIMARY_NAV, ...NUTRITION_SECONDARY_NAV].map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.mobileLink} ${active ? styles.mobileLinkActive : ''}`}
                >
                  <MaterialSymbol name={item.icon} filled={active} size={16} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </section>
  );
}
