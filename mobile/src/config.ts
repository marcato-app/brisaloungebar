// Onde o app fala com a API. Em produção é o próprio site; pra testar contra
// um servidor local, define EXPO_PUBLIC_API_URL antes de subir o Metro
// (ex: EXPO_PUBLIC_API_URL=http://192.168.0.10:8902 npx expo start).
// Precisa ser o IP da máquina na rede, não localhost — "localhost" dentro do
// celular é o próprio celular.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://brisaloungebar.com.br').replace(/\/+$/, '');

// De quanto em quanto tempo as telas que mostram movimento (mapa de mesas,
// quadro de setor) se atualizam sozinhas. Mesmo intervalo do PDV web.
export const POLL_MS = 6000;
