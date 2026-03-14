# Novo Cronograma SEC - Guia de Implantação (GitHub Pages)

Este projeto foi configurado para funcionar como um site estático no GitHub Pages usando **GitHub Actions**.

## 🚀 Como corrigir o erro de Build (Jekyll / docs):

O erro que você está vendo acontece porque o GitHub está tentando procurar uma pasta chamada `docs` que não existe. **Você precisa mudar a fonte do deploy nas configurações do GitHub.**

### Passo a Passo:

1.  **Vá para o seu repositório no GitHub.**
2.  Clique na aba **Settings** (Configurações) no topo.
3.  No menu lateral esquerdo, clique em **Pages**.
4.  Em **Build and deployment > Source**, você verá um menu suspenso.
5.  **MUDE** de "Deploy from a branch" para **"GitHub Actions"**.
6.  Pronto! Agora o GitHub usará o arquivo que eu criei em `.github/workflows/deploy.yml` para fazer o build automático do seu projeto React/Vite.

## Por que isso resolve?
Ao selecionar **GitHub Actions**, o GitHub para de procurar a pasta `docs` e para de usar o Jekyll. Ele passará a usar o script profissional que eu configurei, que instala as dependências, faz o build do Vite e publica apenas os arquivos necessários da pasta `dist`.

---

## Scripts Disponíveis:
* `npm run build`: Gera a pasta `dist` com o site pronto.
* `npm run dev`: Inicia o ambiente de desenvolvimento.
