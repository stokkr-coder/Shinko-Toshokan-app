# Biblioteca Shinko

Código-fonte privado da aplicação **Biblioteca Shinko**, destinada ao controle pessoal de livros digitais, regras de classificação, histórico de leitura, metas e cópias de segurança do catálogo.

## Tecnologias

O projeto utiliza React, TypeScript, Vite, Express, tRPC, Drizzle ORM e MySQL/TiDB. A autenticação e os serviços de hospedagem usados na versão publicada são fornecidos pelo ambiente Manus.

## Execução local

Instale as dependências e execute o servidor de desenvolvimento:

```bash
pnpm install
pnpm dev
```

Para validar o projeto antes de qualquer alteração, execute:

```bash
pnpm test
pnpm check
pnpm build
```

## Segurança e configuração

Este repositório não contém credenciais, arquivos `.env`, tokens do GitHub, bancos de dados, arquivos digitais nem backups com dados pessoais. Para executar uma cópia fora do ambiente original, configure variáveis de ambiente próprias para banco de dados, OAuth e demais integrações conforme a infraestrutura escolhida.

O repositório `Shinko-Toshokan` permanece dedicado aos snapshots JSON do catálogo. Este repositório guarda somente o código-fonte da aplicação.
