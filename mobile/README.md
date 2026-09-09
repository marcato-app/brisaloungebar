# Brisa PDV — app nativo (Android e iOS)

App React Native puro (Expo SDK 57 + TypeScript) que fala com a mesma API do
PDV web (`/api/pdv/*` no Worker). Não é webview nem wrapper: todas as telas
são componentes nativos.

O PDV do navegador continua existindo e é o caminho para **Windows**
(instalável como PWA). Este app é para o celular do garçom.

## Rodar em desenvolvimento

```bash
cd mobile
npm install
npx expo start                 # aponta pra https://brisaloungebar.com.br
```

Para testar contra um servidor local, passe o IP da máquina na rede — dentro
do celular, `localhost` é o próprio celular:

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:8902 npx expo start
```

Leia o QR code com o Expo Go (Android) ou a câmera (iOS).

## Gerar o instalável

Precisa de uma conta Expo (grátis) e do EAS CLI:

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview   # APK pra instalar direto
eas build --platform ios                          # exige conta Apple Developer
```

O `--profile preview` gera um APK que se instala pelo próprio link — não passa
pela Play Store. Para iOS não existe esse caminho: a Apple exige conta de
desenvolvedor (US$ 99/ano) mesmo para instalar em aparelho próprio.

## Como está organizado

| Arquivo | O que é |
| --- | --- |
| `src/api.ts` | `fetch` com `Authorization: Bearer`, erro em português, 401 global |
| `src/session.tsx` | Login e token guardados no Keychain/Keystore (`expo-secure-store`) |
| `src/hooks.ts` | `useApi` (busca + polling só com a tela em foco) e `useAction` (trava duplo toque) |
| `src/theme.ts` | Mesma paleta do `pdv.html` — trocar de aparelho não pode parecer outro sistema |
| `src/ui.tsx` | Botão, campo, pill, avatar, FAB, busca |
| `src/screens/` | Uma tela por bloco do menu, com as mesmas travas de cargo da API |

## Por que tem `react-native-web` aqui

O app é nativo — `react-native-web` não muda isso, é só um alvo a mais.
Ele existe pra dar `npm run web`, que abre o app no navegador: é assim que
dá pra clicar em todas as telas e caçar erro de runtime sem precisar de um
celular ou emulador na mão. O que vai pro APK/IPA não inclui nada disso.

Detalhe: `expo-secure-store` não tem implementação web, então na versão de
navegador a sessão não sobrevive a um F5 (no celular sobrevive, fica no
Keychain/Keystore). É só do modo de teste.

## Conferindo antes de publicar

```bash
npx tsc --noEmit          # tipos (a API inteira está tipada em src/types.ts)
npx expo export --platform android   # prova que o bundle fecha
```

Não há teste de UI automatizado aqui: o que garante o contrato com o servidor
são os testes da API (`node test/pdv.test.mjs`, na raiz do repo) mais a
tipagem de `src/types.ts`, que quebra a compilação se a resposta mudar de
forma.
