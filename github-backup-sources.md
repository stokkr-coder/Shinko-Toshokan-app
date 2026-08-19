# Fontes — Backup pessoal no GitHub

- [GitHub REST API — Repository contents](https://docs.github.com/rest/repos/contents): a API cria ou atualiza arquivos com conteúdo codificado em Base64; para token de granularidade fina, a gravação exige a permissão de repositório `Contents: write`. A atualização de um arquivo existente requer o SHA atual e as operações de conteúdo devem ser serializadas para evitar conflitos.
- [GitHub — Fine-grained personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens): tokens podem ser limitados a um único repositório e a permissões específicas.
