import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabParamList } from '../types';
import { Colors } from '../utils/theme';

import HomeScreen from '../screens/home/HomeScreen';
import FishermenScreen from '../screens/fishermen/FishermenScreen';
import BuyersScreen from '../screens/buyers/BuyersScreen';
import RegisterScreen from '../screens/register/RegisterScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

import {
  House,
  Ship,
  Handshake,
  ClipboardList,
  Settings,
} from 'lucide-react-native';

const Tab = createBottomTabNavigator<TabParamList>();

const TABS = [
  { name: 'Home' as const, label: 'Home', icon: House },
  { name: 'Fishermen' as const, label: 'Fishermen', icon: Ship },
  { name: 'Buyers' as const, label: 'Buyers', icon: Handshake },
  { name: 'Register' as const, label: 'Register', icon: ClipboardList },
  { name: 'SettingsTab' as const, label: 'Settings', icon: Settings },
];


function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(251,249,244,0.97)',
        borderTopWidth: 1,
        borderTopColor: Colors.outlineVariant,
        paddingBottom: insets.bottom || 8,
        paddingTop: 8,
        paddingHorizontal: 8,
        elevation: 16,
        shadowColor: '#D6CFC1',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      }}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = TABS[index];

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
        <TouchableOpacity
  key={route.key}
  onPress={onPress}
  activeOpacity={0.7}
  style={{
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: isFocused
      ? 'rgba(6,95,70,0.08)'
      : 'transparent',
  }}
>
  {(() => {
    const Icon = tab.icon;

    return (
      <Icon
        size={22}
        color={isFocused ? Colors.emerald800 : Colors.outline}
        strokeWidth={2.3}
      />
    );
  })()}

  <Text
    style={{
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: isFocused ? Colors.emerald800 : Colors.outline,
      marginTop: 4,
    }}
  >
    {tab.label}
  </Text>
</TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"        component={HomeScreen} />
      <Tab.Screen name="Fishermen"   component={FishermenScreen} />
      <Tab.Screen name="Buyers"      component={BuyersScreen} />
      <Tab.Screen name="Register"    component={RegisterScreen} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}