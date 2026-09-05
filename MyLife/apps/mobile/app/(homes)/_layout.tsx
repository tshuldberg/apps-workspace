import React from 'react';
import { Tabs } from 'expo-router';
import { ModuleThemeProvider } from '@mylife/ui';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';

export default function HomesLayout() {
  return (
    <ModuleThemeProvider module="homes">
      <ModuleLayoutWrapper moduleId="homes" errorBoundary={true} lockGuard={false}>
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="properties" options={{ title: 'Properties' }} />
        <Tabs.Screen name="maintenance" options={{ title: 'Maintenance' }} />
        <Tabs.Screen name="cost/index" options={{ title: 'Costs' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
        <Tabs.Screen name="insights" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="property/[id]" options={{ href: null }} />
        <Tabs.Screen name="property/add" options={{ href: null }} />
        <Tabs.Screen name="maintenance/[id]" options={{ href: null }} />
        <Tabs.Screen name="maintenance/add" options={{ href: null }} />
        <Tabs.Screen name="cost/[id]" options={{ href: null }} />
        <Tabs.Screen name="cost/add" options={{ href: null }} />
        <Tabs.Screen name="contractor/index" options={{ href: null }} />
        <Tabs.Screen name="contractor/[id]" options={{ href: null }} />
        <Tabs.Screen name="contractor/add" options={{ href: null }} />
        <Tabs.Screen name="insurance/index" options={{ href: null }} />
        <Tabs.Screen name="insurance/[id]" options={{ href: null }} />
        <Tabs.Screen name="insurance/add" options={{ href: null }} />
        <Tabs.Screen name="document/index" options={{ href: null }} />
        <Tabs.Screen name="document/[id]" options={{ href: null }} />
        <Tabs.Screen name="document/add" options={{ href: null }} />
        <Tabs.Screen name="inventory/index" options={{ href: null }} />
        <Tabs.Screen name="inventory/room/[id]" options={{ href: null }} />
        <Tabs.Screen name="inventory/item/[id]" options={{ href: null }} />
        <Tabs.Screen name="inventory/item/add" options={{ href: null }} />
        <Tabs.Screen name="appliance/index" options={{ href: null }} />
        <Tabs.Screen name="appliance/[id]" options={{ href: null }} />
        <Tabs.Screen name="appliance/add" options={{ href: null }} />
        <Tabs.Screen name="project/index" options={{ href: null }} />
        <Tabs.Screen name="project/[id]" options={{ href: null }} />
        <Tabs.Screen name="project/add" options={{ href: null }} />
        <Tabs.Screen name="project/dependencies" options={{ href: null }} />
        <Tabs.Screen name="cost-predictor" options={{ href: null }} />
        <Tabs.Screen name="forecasting" options={{ href: null }} />
        <Tabs.Screen name="warranties" options={{ href: null }} />
      </ModuleLayoutWrapper>
    </ModuleThemeProvider>
  );
}
