import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from './src/session';
import { colors, sectorLabel } from './src/theme';
import type { RootStackParamList } from './src/navigation';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ComandasScreen from './src/screens/ComandasScreen';
import ComandaScreen from './src/screens/ComandaScreen';
import SetorScreen from './src/screens/SetorScreen';
import ClientesScreen from './src/screens/ClientesScreen';
import EstoqueScreen from './src/screens/EstoqueScreen';
import FinanceiroScreen from './src/screens/FinanceiroScreen';
import FuncionariosScreen from './src/screens/FuncionariosScreen';
import ConfiguracoesScreen from './src/screens/ConfiguracoesScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Tema escuro no navigator inteiro: sem isto o fundo padrão do React
// Navigation é branco e pisca a cada transição — num bar à noite isso cega
// quem está usando.
const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.gold,
    background: colors.black,
    card: colors.blackSoft,
    text: colors.text,
    border: colors.borderSoft,
    notification: colors.gold,
  },
};

function Routes() {
  const { me, loading } = useSession();

  if (loading) {
    return (
      <View style={s.splash}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  // Sem sessão só existe o login: o stack nem chega a montar as telas
  // internas, então não tem como cair numa delas por engano (deep link,
  // botão voltar) sem estar logado.
  if (!me) return <LoginScreen />;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.blackSoft },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: colors.black },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Brisa PDV' }} />
      <Stack.Screen name="Comandas" component={ComandasScreen} options={{ title: 'Comandas' }} />
      <Stack.Screen
        name="Comanda"
        component={ComandaScreen}
        options={({ route }) => ({ title: route.params.label })}
      />
      <Stack.Screen
        name="Setor"
        component={SetorScreen}
        options={({ route }) => ({ title: sectorLabel[route.params.sector] || 'Setor' })}
      />
      <Stack.Screen name="Clientes" component={ClientesScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="Estoque" component={EstoqueScreen} options={{ title: 'Estoque' }} />
      <Stack.Screen name="Financeiro" component={FinanceiroScreen} options={{ title: 'Financeiro' }} />
      <Stack.Screen name="Funcionarios" component={FuncionariosScreen} options={{ title: 'Funcionários' }} />
      <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} options={{ title: 'Configurações' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.blackSoft} />
      <NavigationContainer theme={navTheme}>
        <SessionProvider>
          <Routes />
        </SessionProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.black },
});
