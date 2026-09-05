import { Tabs } from 'expo-router';
import { ModuleLayoutWrapper } from '../../components/ModuleLayoutWrapper';
import { BiometricGate } from '../../components/classes/BiometricGate';

export default function ClassesLayout() {
  return (
    <BiometricGate>
      <ModuleLayoutWrapper moduleId="classes">
        <Tabs.Screen name="index" options={{ title: 'Schedule' }} />
        <Tabs.Screen name="assignments" options={{ title: 'Assignments' }} />
        <Tabs.Screen name="grades" options={{ title: 'Grades' }} />
        <Tabs.Screen name="study" options={{ title: 'Study' }} />
        <Tabs.Screen name="degree" options={{ title: 'Degree' }} />
        <Tabs.Screen name="lifelong" options={{ title: 'Lifelong' }} />
        <Tabs.Screen name="applications" options={{ title: 'Applications' }} />
        <Tabs.Screen name="tests" options={{ title: 'Tests' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      </ModuleLayoutWrapper>
    </BiometricGate>
  );
}
