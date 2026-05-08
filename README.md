# ⚽ Figurinha da Copa — Qatar 2022

Aplicativo web para criar sua figurinha personalizada da Copa do Mundo Qatar 2022.

## Como funciona

1. O usuário envia uma foto do rosto
2. A foto é encaixada na silhueta do template
3. O usuário digita nome e data
4. Clica em **Baixar** → salva o PNG final

## 🚀 Deploy no Vercel (passo a passo)

### 1. Suba para o GitHub

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "feat: figurinha da copa"

# Crie um repositório no github.com e então:
git remote add origin https://github.com/SEU_USUARIO/copa-figurinha.git
git push -u origin main
```

### 2. Conecte ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **Add New → Project**
3. Selecione o repositório `copa-figurinha`
4. As configurações são detectadas automaticamente (Vite):
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Clique em **Deploy** ✅

### 3. Pronto!

Seu site estará em `https://copa-figurinha.vercel.app` (ou URL personalizada).

---

## Desenvolvimento local

```bash
npm install
npm run dev
```

Acesse: [http://localhost:5173](http://localhost:5173)

## Personalização

Para alterar os textos padrões do cartão (nome/data), edite as constantes em `src/App.jsx`:

```js
const NAME_BANNER = { x: 88, y: 480, w: 322, h: 36 }
const DATE_BANNER = { x: 155, y: 520, w: 160, h: 35 }
```

Para trocar o template, substitua `public/arte_copa.PNG` por sua arte (mantenha o nome do arquivo).

---

*Gerado com ❤️ para a torcida brasileira 🇧🇷*
