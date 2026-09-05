import { TravelBulletList, TravelPanel } from '../_ui';

export default function TravelDestinationsPage() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <TravelPanel
        eyebrow="Destinations"
        title="Collect the places you go"
        body="Countries, cities, and bucket-list spots will live here with visited vs wishlist state and lightweight counters."
      >
        <TravelBulletList
          items={[
            'Destinations track visit count, last-visit date, and whether they are planned, visited, or bucket list',
            'Country and city counters stay private -- no public sharing, no leaderboard, no data broker',
            'Free-form notes and favorite spots stay attached across every trip to the same destination',
          ]}
        />
      </TravelPanel>
    </div>
  );
}
