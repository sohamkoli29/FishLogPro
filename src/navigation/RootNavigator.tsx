import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types';
import { Colors } from '../utils/theme';
import TabNavigator from './TabNavigator';

import NewPurchaseEntryScreen from '../screens/purchases/NewPurchaseEntryScreen';
import EntryDetailScreen      from '../screens/purchases/EntryDetailScreen';
import NewSalesOrderScreen    from '../screens/sales/NewSalesOrderScreen';
import OrderDetailScreen      from '../screens/sales/OrderDetailScreen';
import PaymentsScreen         from '../screens/payments/PaymentsScreen';
import StatementScreen        from '../screens/statements/StatementScreen';
import BackupRestoreScreen    from '../screens/backup/BackupRestoreScreen';
import AddFishermanScreen     from '../screens/fishermen/AddFishermanScreen';
import AddBuyerScreen         from '../screens/buyers/AddBuyerScreen';
import SettingsScreen         from '../screens/settings/SettingsScreen';
import FishermanDetailScreen from '../screens/fishermen/FishermanDetailScreen';
import BuyerDetailScreen     from '../screens/buyers/BuyerDetailScreen';


const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: Colors.surfaceContainerLow },
          headerTintColor: Colors.primary,
          headerTitleStyle: {
            fontWeight: '700',
            color: Colors.onSurface,
            fontSize: 17,
          },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.surface },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={TabNavigator}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NewPurchaseEntry"
          component={NewPurchaseEntryScreen}
          options={{ title: 'New Purchase Entry' }}
        />
        <Stack.Screen
          name="EntryDetail"
          component={EntryDetailScreen}
          options={{ title: 'Entry Detail' }}
        />
        <Stack.Screen
          name="NewSalesOrder"
          component={NewSalesOrderScreen}
          options={{ title: 'New Sales Order' }}
        />
        <Stack.Screen
          name="OrderDetail"
          component={OrderDetailScreen}
          options={{ title: 'Order Detail' }}
        />
        <Stack.Screen
          name="PaymentsScreen"
          component={PaymentsScreen}
          options={({ route }) => ({
            title: `Payments — ${route.params.name}`,
          })}
        />
        <Stack.Screen
          name="StatementScreen"
          component={StatementScreen}
          options={{ title: 'Transaction Statement' }}
        />
        <Stack.Screen
          name="BackupRestore"
          component={BackupRestoreScreen}
          options={{ title: 'Backup & Restore' }}
        />
        <Stack.Screen
          name="AddFisherman"
          component={AddFishermanScreen}
          options={({ route }) => ({
            title: route.params?.fishermenId ? 'Edit Fisherman' : 'Add Fisherman',
          })}
        />
        <Stack.Screen
          name="AddBuyer"
          component={AddBuyerScreen}
          options={({ route }) => ({
            title: route.params?.buyerId ? 'Edit Buyer' : 'Add Buyer',
          })}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Settings' }}
        />
        <Stack.Screen
  name="FishermanDetail"
  component={FishermanDetailScreen}
  options={({ route }) => ({ title: route.params.name })}
/>
<Stack.Screen
  name="BuyerDetail"
  component={BuyerDetailScreen}
  options={({ route }) => ({ title: route.params.name })}
/>
      </Stack.Navigator>
    </NavigationContainer>
  );
}