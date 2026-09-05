import { fetchBudgetHelpContent } from '../actions';
import { BudgetHero, BudgetPage, BudgetPanel, BudgetRouteCard, BudgetRouteGrid, BudgetTable } from '../primitives';

export const dynamic = 'force-dynamic';

export default async function BudgetHelpPage() {
  const content = await fetchBudgetHelpContent();

  return (
    <BudgetPage>
      <BudgetHero description={`Support: ${content.supportEmail}`} eyebrow="Help" title="Help Center" />

      <BudgetPanel description="Browse the core product areas." title="Categories">
        <BudgetRouteGrid>
          {content.categories.map((category) => (
            <BudgetRouteCard
              key={category.id}
              description={category.description}
              href={`/budget/help#${category.id}`}
              icon={category.icon}
              title={category.title}
            />
          ))}
        </BudgetRouteGrid>
      </BudgetPanel>

      <BudgetPanel description="Frequently asked questions from the shared budget help content." title="FAQs">
        <BudgetTable
          columns={['Question', 'Answer']}
          rows={content.faqs.map((faq) => [faq.question, faq.answer])}
        />
      </BudgetPanel>

      <BudgetPanel description="Short guided walkthroughs." title="Tutorials">
        <BudgetTable
          columns={['Title', 'Summary', 'Duration']}
          rows={content.tutorials.map((tutorial) => [tutorial.title, tutorial.summary, tutorial.duration])}
        />
      </BudgetPanel>

      <BudgetPanel description="Recent releases in the budget module." title="Changelog">
        <BudgetTable
          columns={['Version', 'Title', 'Published', 'Highlights']}
          rows={content.changelog.map((entry) => [
            entry.version,
            entry.title,
            entry.publishedOn,
            entry.bullets.join(' • '),
          ])}
        />
      </BudgetPanel>
    </BudgetPage>
  );
}
