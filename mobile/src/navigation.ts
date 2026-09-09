import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Sector } from './types';

/** Rotas do app. Tipar aqui é o que faz o TypeScript reclamar quando uma
 *  tela navega passando parâmetro errado — erro que só apareceria no
 *  celular do garçom, no meio do turno. */
export type RootStackParamList = {
  Home: undefined;
  Comandas: undefined;
  Comanda: { tabId: string; label: string };
  Setor: { sector: Sector };
  Clientes: undefined;
  Estoque: undefined;
  Financeiro: undefined;
  Funcionarios: undefined;
  Configuracoes: undefined;
};

export type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
