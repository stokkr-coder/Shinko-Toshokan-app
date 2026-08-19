# Publicação externa da Biblioteca Shinko

Este roteiro prepara a Biblioteca Shinko para uma hospedagem externa gratuita com **Render** para a aplicação, **Aiven for MySQL** para os dados e **Login com Google** para controlar o acesso. A configuração recomendada é um acervo compartilhado: o proprietário administra os dados e os e-mails autorizados entram apenas para consultar e pesquisar.

> **Importante:** não desligue a versão atual antes de validar a cópia externa. Mantenha o acervo atual e seus backups GitHub como referência até concluir a importação e o primeiro teste de acesso.

## 1. O que será publicado

| Componente | Serviço | Papel |
|---|---|---|
| Aplicação React, Express e tRPC | Render Web Service | Interface, API, sessão e login |
| Banco MySQL | Aiven for MySQL | Livros, regras, leituras, metas e permissões |
| Identidade | Google Cloud OAuth | Login com Google e identificação do usuário |
| Código e validação | GitHub | Repositório e workflow de testes |
| Backup do catálogo | GitHub | Snapshots JSON já existentes |

O serviço gratuito do Render é adequado para demonstração e uso leve, mas hiberna após 15 minutos sem acesso; o primeiro acesso após a hibernação pode levar aproximadamente um minuto. O disco local também é temporário, portanto os dados devem permanecer no Aiven e os arquivos digitais precisam usar armazenamento externo. Consulte a [documentação do Render](https://render.com/docs/free).

O Aiven fornece MySQL gratuito com 1 GB de armazenamento, backups e sem prazo fixo, embora possa desligar o serviço após inatividade continuada. Consulte a [documentação do Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier).

## 2. Criar as contas gratuitas

Crie uma conta no [Render](https://dashboard.render.com/register), outra no [Aiven](https://console.aiven.io/signup) e use sua conta Google atual para entrar no [Google Cloud Console](https://console.cloud.google.com/). Não é necessário compartilhar senhas comigo. Quando cada conta estiver criada, você só precisará copiar identificadores e segredos para os campos seguros da plataforma correspondente.

## 3. Criar o banco MySQL no Aiven

No console do Aiven, crie um serviço **MySQL**, escolha o plano **Free**, selecione a região mais próxima dos usuários e aguarde o status ficar como em execução. Na tela de conexão, copie a URI MySQL completa. Ela será usada como `DATABASE_URL` no Render e deve permanecer secreta.

> Nunca cole a URI do banco no código, no GitHub ou em mensagens públicas. Ela contém a senha do banco.

## 4. Criar o Login com Google

No Google Cloud Console, crie um projeto chamado `Biblioteca Shinko`. Em **Google Auth Platform**, preencha a marca do aplicativo, informe seu e-mail de suporte e adicione os e-mails das pessoas que poderão testar o app. Em seguida, crie uma credencial do tipo **OAuth client ID** para **Web application**.

Inicialmente, use o callback abaixo, substituindo `SEU-SERVICO` pelo nome que será escolhido no Render:

```text
https://SEU-SERVICO.onrender.com/auth/google/callback
```

Anote o **Client ID** e o **Client secret**. O Google exige que o callback corresponda exatamente ao endereço registrado; se forem diferentes, o login falhará com `redirect_uri_mismatch`. O fluxo seguro usa código de autorização, `state` contra CSRF e validação da identidade recebida. Consulte a [documentação oficial do Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) e do [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

## 5. Variáveis de ambiente no Render

Depois de criar o Web Service no Render, registre os valores abaixo na área **Environment**. Nunca crie um arquivo `.env` no repositório público.

| Variável | Origem | Uso |
|---|---|---|
| `DATABASE_URL` | URI do Aiven | Conexão MySQL segura |
| `GOOGLE_CLIENT_ID` | Google Cloud | Identifica o app no login Google |
| `GOOGLE_CLIENT_SECRET` | Google Cloud | Permite trocar o código de login por identidade |
| `GOOGLE_REDIRECT_URI` | URL final do Render | Deve ser igual ao callback registrado no Google |
| `SESSION_SECRET` | Valor aleatório longo | Assina a sessão do app |
| `APP_BASE_URL` | URL final do Render | Origem pública do app |
| `OWNER_GOOGLE_SUB` | Primeiro login do proprietário | Mantém o papel de administrador |
| `ALLOWED_EMAILS` | Lista separada por vírgulas | Libera leitores convidados |
| `GITHUB_BACKUP_TOKEN` | Token GitHub restrito | Mantém o backup diário do catálogo |

O identificador principal do proprietário deve ser o `sub` retornado pelo Google, não o e-mail. O e-mail pode mudar; o `sub` é o identificador estável da conta Google.

## 6. Publicar no Render

No Render, escolha **New > Web Service**, conecte o repositório `stokkr-coder/Shinko-Toshokan-app` e selecione a branch `main`. Use Node.js, escolha o plano Free e informe estes comandos:

```text
Build command: pnpm install --frozen-lockfile && pnpm build
Start command: pnpm start
```

O serviço precisa atender no valor da variável `PORT` fornecida pelo Render. Depois do primeiro deploy, copie a URL `https://SEU-SERVICO.onrender.com`, atualize `APP_BASE_URL` e `GOOGLE_REDIRECT_URI`, e registre a mesma URL de callback no Google Cloud.

## 7. Importar e validar o acervo

Antes de convidar leitores, importe o snapshot ou a exportação atual para o novo MySQL. Em seguida, valide este roteiro:

1. Entrar com a conta Google do proprietário e confirmar papel de administrador.
2. Conferir quantidade de livros, regras, histórico, metas e lista “Quero ler”.
3. Entrar com um e-mail autorizado e confirmar que a edição, importação, backup e exclusão estão bloqueados.
4. Entrar com um e-mail não autorizado e confirmar que o app recusa o acesso.
5. Executar um backup e conferir o novo snapshot no repositório GitHub.

## 8. Limitações e operação contínua

O Render gratuito pode hibernar e o Aiven gratuito pode pausar por inatividade. Para evitar perda de confiança dos convidados, mostre uma mensagem de “iniciando o serviço” quando o primeiro acesso demorar. Mantenha a exportação Excel e o backup GitHub como rotinas independentes. Antes de qualquer atualização, abra uma pull request: a branch `main` exige a validação de testes, tipos e build.

## 9. O que ainda será adaptado no código

O projeto atual usa autenticação, armazenamento e agendamentos integrados ao ambiente Manus. A migração externa precisa substituir essas integrações por login Google, sessão própria, lista de e-mails autorizados, armazenamento externo para arquivos digitais e um cron compatível com o Render. Essas mudanças serão preparadas em uma etapa separada, sem alterar a versão atual publicada até que a cópia externa seja validada.
