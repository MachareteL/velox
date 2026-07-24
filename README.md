# Automação de Leitura e Envio WhatsApp

Aplicação em Node.js desenvolvida para monitorar mensagens no WhatsApp Web e realizar processamento de requisições de forma rápida e assíncrona.

## Arquivos no Projeto
- `index.js`: Código principal com o cliente do WhatsApp, parser do HTML e envio de requisições.
- `package.json`: Configurações de dependências do projeto.
- `.env`: Arquivo de variáveis de ambiente.
- `.env.example`: Modelo de configuração do ambiente.

## Como Executar no Windows 10

### 1. Pré-requisitos
- **Node.js (versão LTS 18 ou 20)**
- **Git para Windows** (opcional, para clonar ou gerenciar o código)
- **PM2** (gerenciador de processos para manter a aplicação 24/7 em segundo plano)

### 2. Instalação e Execução
1. Abra o terminal (PowerShell ou Prompt de Comando) na pasta do projeto.
2. Instale as dependências:
   ```cmd
   npm install
   ```
3. Execute em modo de teste:
   ```cmd
   npm start
   ```
4. Para manter rodando 24/7 (mesmo se reiniciar o terminal ou fechar a janela), instale e inicie com **PM2**:
   ```cmd
   npm install -g pm2
   pm2 start index.js --name "whatsapp-automator"
   pm2 save
   ```
