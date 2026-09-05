import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function ShopLayout() {
  return (
    <ModuleLayoutWrapper moduleId="shop">
      <Tabs.Screen name="index" options={{ title: 'Wishlist' }} />
      <Tabs.Screen name="purchases" options={{ title: 'Purchases' }} />
      <Tabs.Screen name="warranties" options={{ title: 'Warranties' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      <Tabs.Screen name="wishlist/create-list" options={{ href: null, title: 'New wishlist' }} />
      <Tabs.Screen name="wishlist/[listId]" options={{ href: null, title: 'Wishlist' }} />
      <Tabs.Screen name="wishlist/add-item" options={{ href: null, title: 'Add item' }} />
      <Tabs.Screen name="wishlist/item/[itemId]" options={{ href: null, title: 'Item' }} />
      <Tabs.Screen name="purchase/log" options={{ href: null, title: 'Log purchase' }} />
      <Tabs.Screen name="purchase/[id]" options={{ href: null, title: 'Purchase' }} />
      <Tabs.Screen name="purchase/edit/[id]" options={{ href: null, title: 'Edit purchase' }} />
      <Tabs.Screen name="warranty/add" options={{ href: null, title: 'Add warranty' }} />
      <Tabs.Screen name="warranty/[id]" options={{ href: null, title: 'Warranty' }} />
      <Tabs.Screen name="warranty/claim/[id]" options={{ href: null, title: 'File a claim' }} />
      <Tabs.Screen name="sizes/index" options={{ href: null, title: 'Sizes' }} />
      <Tabs.Screen name="sizes/add" options={{ href: null, title: 'Add size' }} />
      <Tabs.Screen name="sizes/[id]" options={{ href: null, title: 'Size' }} />
      <Tabs.Screen name="preferences/index" options={{ href: null, title: 'Preferences' }} />
      <Tabs.Screen name="preferences/[category]" options={{ href: null, title: 'Preferences' }} />
      <Tabs.Screen name="gifts/index" options={{ href: null, title: 'Gifts' }} />
      <Tabs.Screen name="gifts/add-person" options={{ href: null, title: 'Add person' }} />
      <Tabs.Screen name="gifts/add" options={{ href: null, title: 'Log a gift' }} />
      <Tabs.Screen name="gifts/[personId]" options={{ href: null, title: 'Person' }} />
      <Tabs.Screen name="gifts/ideas/[personId]" options={{ href: null, title: 'Gift ideas' }} />
      <Tabs.Screen name="spending/index" options={{ href: null, title: 'Spending' }} />
      <Tabs.Screen name="spending/impulse" options={{ href: null, title: 'Impulse log' }} />
      <Tabs.Screen name="spending/thirty-day-rule" options={{ href: null, title: '30-day rule' }} />
      <Tabs.Screen name="research/index" options={{ href: null, title: 'Research' }} />
      <Tabs.Screen name="research/add" options={{ href: null, title: 'New comparison' }} />
      <Tabs.Screen name="research/[id]" options={{ href: null, title: 'Comparison' }} />
      <Tabs.Screen name="stores/index" options={{ href: null, title: 'Stores' }} />
      <Tabs.Screen name="stores/[name]" options={{ href: null, title: 'Store' }} />
      <Tabs.Screen name="review/index" options={{ href: null, title: 'Year in Review' }} />
      <Tabs.Screen name="review/[year]" options={{ href: null, title: 'Year in Review' }} />
    </ModuleLayoutWrapper>
  );
}
