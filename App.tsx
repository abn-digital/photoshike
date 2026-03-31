import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { AppProvider } from './context/AppContext';
import { Colors } from './constants/theme';

import ShootScreen from './screens/ShootScreen';
import TemplatesScreen from './screens/TemplatesScreen';
import ValidateScreen from './screens/ValidateScreen';
import ProjectsScreen from './screens/ProjectsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LobbyScreen from './screens/LobbyScreen';
import AnchorDevModeScreen from './screens/AnchorDevModeScreen';

export type RootStackParamList = {
  Lobby: undefined;
  Main: undefined;
  Templates: undefined;
  Validate: undefined;
  AnchorDevMode: undefined;
};

export type MainTabParamList = {
  Shoot: undefined;
  Projects: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgSurface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tab.Screen
        name="Shoot"
        component={ShootScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'camera' : 'camera-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'image-multiple' : 'image-multiple-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'account' : 'account-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" backgroundColor={Colors.bgDark} />
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: Colors.primary,
              background: Colors.bgDark,
              card: Colors.bgSurface,
              text: Colors.textPrimary,
              border: Colors.border,
              notification: Colors.primary,
            },
            fonts: {
              regular: { fontFamily: 'System', fontWeight: '400' },
              medium: { fontFamily: 'System', fontWeight: '500' },
              bold: { fontFamily: 'System', fontWeight: '700' },
              heavy: { fontFamily: 'System', fontWeight: '900' },
            },
          }}
        >
          <Stack.Navigator
            initialRouteName="Lobby"
            screenOptions={{ headerShown: false, animation: 'fade' }}
          >
            <Stack.Screen name="Lobby" component={LobbyScreen} />
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="Templates"
              component={TemplatesScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
            <Stack.Screen
              name="Validate"
              component={ValidateScreen}
              options={{ animation: 'slide_from_right' }}
            />
            <Stack.Screen
              name="AnchorDevMode"
              component={AnchorDevModeScreen}
              options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
