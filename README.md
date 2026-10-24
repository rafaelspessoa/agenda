# Agenda e Planejamento

Aplicacao web para compradores, recepcao e fornecedores, hospedada na Vercel com PostgreSQL gerenciado pela Neon. Compradores e recepcao acessam com contas individuais; fornecedores entram por um codigo individual emitido pelo comprador.

## Arquivos principais

- `AGENDA.html`, `agenda.css` e `agenda.js`: interface e regras de negocio existentes.
- `cloud.js`: adaptador de autenticacao, cache local e sincronizacao.
- `api/`: endpoints de autenticacao, dados, contas, recepcao e fornecedores.
- `db/schema.sql`: tabelas, indices e restricoes do PostgreSQL.
- `scripts/bootstrap-admin.mjs`: cria uma unica conta administrativa inicial.

## Publicacao

1. Crie um banco PostgreSQL na Neon e execute `db/schema.sql` no editor SQL do provedor.
2. Configure na Vercel as variaveis `DATABASE_URL` e `APP_TIME_ZONE` (`America/Sao_Paulo` por padrao). Nunca coloque a URL de conexao ou qualquer senha em `agenda.js` ou no navegador.
3. Publique a pasta como projeto Vercel. O arquivo `vercel.json` define a API e os cabecalhos de seguranca.
4. Instale as dependencias (`npm install`), obtenha uma conexao de banco em `.env.local` e defina `APP_ADMIN_USERNAME`, `APP_ADMIN_NAME` e `APP_ADMIN_PASSWORD` nesse arquivo. Use senha forte e nao o envie ao Git.
5. Execute `npm run bootstrap:admin` uma unica vez contra o banco de producao. A senha inicial nao e armazenada em texto; remova-a de `.env.local` depois.
6. Entre no endereco HTTPS publicado como administrador. Cadastre os compradores e a recepcao. Cada comprador cadastra fornecedores e compartilha o codigo emitido pelo sistema.

Para desenvolvimento, instale uma Vercel CLI atual fora das dependencias do projeto (`npm install --global vercel`), configure `.env.local` e use `npm run dev`. Nao use dados reais ate validar o ambiente, as contas e os backups.

## Acesso e dados

- Senhas internas sao armazenadas com `scrypt`; sessoes ficam em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em producao. Tentativas falhas sao limitadas no servidor.
- Cada comprador so le e grava seus proprios registros. A recepcao recebe uma projecao limitada aos campos de atendimento. O fornecedor ve apenas os horarios e atendimentos vinculados ao seu cadastro; reservas e conflitos sao validados no servidor.
- A interface mantem IndexedDB como cache e pode oferecer a importacao inicial dos dados locais apos o primeiro login do comprador. O PostgreSQL e a fonte compartilhada entre computadores.
- Backups locais existentes continuam disponiveis; planeje tambem backup e restauracao do banco PostgreSQL. A pasta compartilhada antiga nao e usada no fluxo cloud.
- HTTPS e obrigatorio para o uso externo. Restrinja as contas administrativas, desative usuarios desligados e nao reutilize codigos de fornecedor.

## Validacao antes de uso real

Execute `npm run check`, confira as variaveis de ambiente e teste com contas descartaveis: dois compradores, uma recepcao e um fornecedor. Verifique isolamento entre compradores, chegada/inicio/finalizacao na recepcao, reserva concorrente do mesmo horario, revogacao de fornecedor, logout/expiracao de sessao e recuperacao de backup.

Este repositorio nao inclui credenciais nem uma instancia Neon/Vercel provisionada. A integracao so fica operacional depois de configurar e publicar esses servicos pela conta autorizada da empresa.