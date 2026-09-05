export interface BudgetHelpCategory {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface BudgetFaqEntry {
  id: string;
  categoryId: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface BudgetTutorialEntry {
  id: string;
  categoryId: string;
  title: string;
  summary: string;
  duration: string;
  icon: string;
}

export interface BudgetChangelogEntry {
  id: string;
  version: string;
  title: string;
  publishedOn: string;
  bullets: string[];
}

export interface BudgetHelpContent {
  supportEmail: string;
  categories: BudgetHelpCategory[];
  faqs: BudgetFaqEntry[];
  tutorials: BudgetTutorialEntry[];
  changelog: BudgetChangelogEntry[];
}

export const BUDGET_HELP_CONTENT: BudgetHelpContent = {
  supportEmail: 'support@mylife.app',
  categories: [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'First steps for accounts, envelopes, and your first budget.',
      icon: 'flag',
    },
    {
      id: 'envelopes',
      title: 'Envelopes & Budgets',
      description: 'Learn category groups, targets, rollovers, and overspending.',
      icon: 'account_balance_wallet',
    },
    {
      id: 'transactions',
      title: 'Transactions',
      description: 'Log purchases, split transactions, and review imported activity.',
      icon: 'list_alt',
    },
    {
      id: 'bank-sync',
      title: 'Bank Sync',
      description: 'Connect institutions, import CSVs, and keep account history clean.',
      icon: 'currency_exchange',
    },
    {
      id: 'goals-debts',
      title: 'Goals & Debts',
      description: 'Track savings progress, payoff plans, and long-term milestones.',
      icon: 'trending_up',
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Use age of money, heatmaps, and cash flow to spot patterns.',
      icon: 'pie_chart',
    },
    {
      id: 'subscriptions',
      title: 'Subscriptions',
      description: 'Monitor renewals, ROI, and cancellation tasks.',
      icon: 'repeat',
    },
  ],
  faqs: [
    {
      id: 'faq-envelope-budgeting',
      categoryId: 'envelopes',
      question: 'What is envelope budgeting?',
      answer:
        'Envelope budgeting gives every dollar a job. You assign available cash to specific categories, then track spending against that category instead of a single generic balance.',
      keywords: ['budgeting', 'envelope', 'ready to budget', 'category'],
    },
    {
      id: 'faq-ready-to-budget',
      categoryId: 'getting-started',
      question: 'Why does Ready to Budget matter?',
      answer:
        'Ready to Budget is the money you can safely assign today. It helps you avoid budgeting future income before it actually reaches your account.',
      keywords: ['ready', 'budget', 'income', 'cash'],
    },
    {
      id: 'faq-overspending',
      categoryId: 'envelopes',
      question: 'What should I do when an envelope goes negative?',
      answer:
        'Cover overspending by moving money from another envelope as soon as possible. Leaving a category negative makes the rest of the plan less accurate.',
      keywords: ['overspending', 'negative', 'cover', 'move money'],
    },
    {
      id: 'faq-transactions',
      categoryId: 'transactions',
      question: 'How do I log my first transaction?',
      answer:
        'Open Transactions or tap the add action, enter amount, direction, account, payee, and envelope, then save. Imported bank activity can also be reviewed from the review queue.',
      keywords: ['transaction', 'payee', 'review', 'log'],
    },
    {
      id: 'faq-recurring',
      categoryId: 'transactions',
      question: 'Can I automate recurring charges?',
      answer:
        'Yes. Use transaction rules and recurring templates to create predictable entries for rent, subscriptions, and other repeated expenses.',
      keywords: ['recurring', 'rules', 'template', 'automation'],
    },
    {
      id: 'faq-bank-sync',
      categoryId: 'bank-sync',
      question: 'How does bank sync work in MyBudget?',
      answer:
        'Bank sync connects supported institutions, imports transaction history, and lets you review matches before they affect your envelopes. CSV import is available when direct sync is not.',
      keywords: ['bank', 'sync', 'plaid', 'csv', 'import'],
    },
    {
      id: 'faq-goals',
      categoryId: 'goals-debts',
      question: 'How should I use savings goals?',
      answer:
        'Create goals for true expenses or longer-term targets, connect them to an envelope, and fund them gradually. Progress rings and milestone views show whether you are on pace.',
      keywords: ['goal', 'savings', 'milestone', 'progress'],
    },
    {
      id: 'faq-debt-payoff',
      categoryId: 'goals-debts',
      question: 'What is the debt payoff planner for?',
      answer:
        'The debt payoff planner compares strategies, models payoff order, and estimates interest saved when you add extra payments to high-priority debts.',
      keywords: ['debt', 'payoff', 'snowball', 'avalanche'],
    },
    {
      id: 'faq-age-of-money',
      categoryId: 'reports',
      question: 'What does Age of Money mean?',
      answer:
        'Age of Money measures how long money sits in your accounts before being spent. A higher number usually means less paycheck-to-paycheck pressure.',
      keywords: ['age of money', 'report', 'cash flow', 'buffer'],
    },
    {
      id: 'faq-subscriptions',
      categoryId: 'subscriptions',
      question: 'How do subscription insights help?',
      answer:
        'Subscription views track monthly cost, renewal timing, cancellation tasks, and ROI so you can quickly spot services that cost more than they return.',
      keywords: ['subscription', 'renewal', 'roi', 'cancel'],
    },
  ],
  tutorials: [
    {
      id: 'tutorial-first-budget',
      categoryId: 'getting-started',
      title: 'Build your first monthly plan',
      summary: 'Set accounts, assign ready-to-budget cash, and cover the essentials first.',
      duration: '4 min',
      icon: 'account_balance_wallet',
    },
    {
      id: 'tutorial-envelope-groups',
      categoryId: 'envelopes',
      title: 'Create envelope groups that stay organized',
      summary: 'Use Needs, Wants, Savings, and Debts to keep category sprawl under control.',
      duration: '3 min',
      icon: 'tune',
    },
    {
      id: 'tutorial-reconcile-sync',
      categoryId: 'bank-sync',
      title: 'Review imported transactions cleanly',
      summary: 'Match, split, categorize, and approve sync activity without losing context.',
      duration: '5 min',
      icon: 'check_circle',
    },
    {
      id: 'tutorial-subscription-audit',
      categoryId: 'subscriptions',
      title: 'Run a subscription cost audit',
      summary: 'Use renewal calendar, ROI, and cancellation assist to trim recurring spend.',
      duration: '6 min',
      icon: 'repeat',
    },
  ],
  changelog: [
    {
      id: 'changelog-1-6',
      version: 'v1.6',
      title: 'Family and split planning tools',
      publishedOn: '2026-04-07',
      bullets: [
        'Added family sharing and envelope visibility controls.',
        'Introduced expense splitting with settlement tracking.',
        'Refreshed onboarding and help center surfaces.',
      ],
    },
    {
      id: 'changelog-1-5',
      version: 'v1.5',
      title: 'Reports and subscription polish',
      publishedOn: '2026-04-07',
      bullets: [
        'Rebuilt reports, cash flow, and spending heatmap for the new budget shell.',
        'Added subscription ROI summaries and renewal planning surfaces.',
      ],
    },
    {
      id: 'changelog-1-4',
      version: 'v1.4',
      title: 'Budget shell refresh',
      publishedOn: '2026-04-06',
      bullets: [
        'Shipped the Obsidian Noir budget shell, shared UI primitives, and refreshed core tabs.',
        'Aligned typography and iconography with the rest of the MyLife hub.',
      ],
    },
  ],
};
