# Requirements Index

> Product requirements, user personas, feature prioritization, subscription tiers, and phased rollout plan.

---

## Overview

The [Product Requirements Document](product-requirements.md) defines what TheMarlinTraders builds, for whom, in what order, and how it makes money. It translates the findings from 10 research documents into a prioritized, phased feature set.

---

## Quick Reference

### Target Market

~15M active US retail traders who trade equities and options at least monthly. Expansion into crypto, forex, futures, and international markets in later phases. The platform targets the gap between consumer tools (TradingView, Robinhood) and institutional terminals (Bloomberg, FactSet).

### User Personas

| Persona | Role | Key Need | Primary Phase |
|---------|------|----------|---------------|
| **Sarah** | Beginner investor | Educational onboarding, clean UI, paper trading | Phase 1 |
| **Marcus** | Active day trader | Scanners, multi-chart layouts, hotkey order entry, journal | Phase 1-2 |
| **Diana** | Swing/position trader | Pattern scanners, alerts, watchlist management | Phase 1-2 |
| **Raj** | Options trader | Options chain, Greeks, P&L diagrams, IV analytics | Phase 2-3 |
| **Alex** | Algo/quant trader | Strategy IDE, backtesting, live deployment, ML pipeline | Phase 4 |
| **Victoria** | Institutional PM | VaR, stress testing, attribution, compliance, team workspaces | Phase 6 |
| **Tyler** | Social trader/creator | Verified performance, idea publishing, marketplace, streaming | Phase 2-5 |

### Feature Prioritization (MoSCoW)

| Priority | Count | Phase | Summary |
|----------|-------|-------|---------|
| **Must Have** | 14 features (M1-M14) | Phase 1 (MVP) | Charting, indicators, real-time data, drawing tools, watchlists, alerts, screener, layouts, mobile, paper trading, dark mode, command palette, keyboard shortcuts, accounts |
| **Should Have** | 16 features (S1-S16) | Phase 2-3 | Journal, social (ideas/profiles/leaderboards), options chain/builder, advanced drawings, heat maps, AI analysis, broker integration, Android, crypto, news, performance dashboard, discussion rooms, widgets |
| **Could Have** | 15 features (C1-C15) | Phase 4-5 | Strategy IDE, backtesting, live deployment, options flow, IV suite, futures, forex, copy trading, marketplace, ML, streaming, Pine Script import, on-chain metrics, pattern recognition, advanced orders |
| **Won't Have** | 6 items | Never | Own brokerage, HFT infrastructure, full Bloomberg replacement, prediction service, physical commodity delivery, proprietary trading |

### Subscription Tiers

| Tier | Price | Target Persona | Highlights |
|------|-------|----------------|------------|
| **Free** | $0 | Sarah | 10 indicators/chart, 100 alerts, 2 charts/tab, paper trading, 15-min delayed data |
| **Pro** | $29/mo | Marcus, Diana | 25 indicators, 500 alerts, 8 charts, real-time data, auto journal, basic AI |
| **Premium** | $79/mo | Raj, Alex, Diana | 50 indicators, unlimited alerts, 16 charts, options + crypto + forex data, IDE, backtesting, full AI |
| **Enterprise** | Custom | Victoria | Unlimited everything, compliance tools, team workspaces, dedicated support, all brokers |

### Phased Rollout

| Phase | Timeline | Focus | Users Target |
|-------|----------|-------|-------------|
| 1 | Months 0-6 | Core charting platform (MVP) | 50K registered, 5K DAU |
| 2 | Months 6-12 | Social layer + journal + options | 200K registered, 20K DAU |
| 3 | Months 12-18 | Advanced analysis + broker integration | 500K registered, 50K DAU |
| 4 | Months 18-24 | Algo trading + strategy IDE | 1M registered, 100K DAU |
| 5 | Months 24-30 | Marketplace + copy trading | 2M registered |
| 6 | Months 30-42 | Institutional features | 50 institutional accounts |

### Revenue Targets

| Year | ARR | Key Driver |
|------|-----|------------|
| 1 | $2.4M | Pro/Premium subscriptions |
| 2 | $12M | Scale + broker referrals + data fees |
| 3 | $25M | Marketplace + enterprise + full monetization mix |

---

## Full Document

For complete details including individual feature descriptions, non-functional requirements (performance targets, scalability, security, accessibility), and KPIs, see the [Product Requirements Document](product-requirements.md).
