# Agenda e Planejamento

Aplicacao web para compradores, recepcao e fornecedores, hospedada na Vercel com PostgreSQL gerenciado pelo Supabase. Compradores e recepcao acessam com contas individuais; laboratorios (fornecedores) entram na area do fornecedor com o codigo do cadastro de Laboratorios e escolhem o comprador.

## Arquivos principais

- `AGENDA.html`, `agenda.css` e `agenda.js`: interface e regras de negocio.
- `cloud.js`: adaptador de autenticacao, cache local e sincronizacao.
- `api/`: endpoints de autenticacao, dados, contas, recepcao, laboratorios (`labs.js`) e area do fornecedor.
- `db/schema.sql`: tabelas, indices, restricoes e RLS do PostgreSQL.
- `scripts/apply-schema.mjs`: aplica o esquema Supabase.
- `scripts/bootstrap-admin.mjs`: cria uma unica conta administrativa inicial.

## Publicacao

1. Crie um projeto no Supabase e aguarde a conclusao do provisionamento.
2. Em **Connect**, escolha a connection string do **Transaction pooler** (porta `6543`). Copie-a para `SUPABASE_DB_URL` em `.env.local`.
3. Em **Database Settings → SSL Configuration**, baixe o certificado raiz do projeto. Localmente, deixe o arquivo `prod-ca-2021.crt` na raiz do projeto; o cliente o carrega e valida automaticamente. Na Vercel, configure o PEM completo em `SUPABASE_DB_CA`. Nao desative a verificacao TLS.
4. Execute `npm run db:apply`. O comando testa a conexao, aplica `db/schema.sql` e confirma as quatro tabelas, sem imprimir credenciais.
5. Configure `SUPABASE_DB_URL`, `SUPABASE_DB_CA` e `APP_TIME_ZONE` (`America/Sao_Paulo` por padrao) como variaveis da Vercel. Nunca coloque a connection string no navegador.
6. Publique a pasta como projeto Vercel. O arquivo `vercel.json` define a API e os cabecalhos de seguranca.
7. Defina `APP_ADMIN_USERNAME`, `APP_ADMIN_NAME` e `APP_ADMIN_PASSWORD` em `.env.local`; execute `npm run bootstrap:admin` uma unica vez contra o banco publicado. Remova a senha inicial do ambiente depois.
8. Entre no endereco HTTPS como administrador, cadastre compradores e recepcao e cadastre os laboratorios (o codigo de cada laboratorio e o acesso dele a area do fornecedor).

Para desenvolvimento, instale uma Vercel CLI atual fora das dependencias do projeto (`npm install --global vercel`), configure `.env.local` e execute `vercel dev` diretamente. Nao crie um script npm `dev` que invoque `vercel dev`, pois isso causa recursao. Nao envie `.env.local` ao Git nem use dados reais antes de validar contas e backups.

## Acesso e dados

- Senhas internas sao armazenadas com `scrypt`; sessoes ficam em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em producao. Tentativas falhas sao limitadas no servidor.
- Cada comprador so le e grava seus proprios registros. A recepcao recebe uma projecao limitada aos campos de atendimento. O fornecedor ve apenas os horarios e atendimentos vinculados ao seu cadastro; reservas e conflitos sao validados no servidor.
- Laboratorios sao uma lista unica da empresa (tabela `labs`): compradores cadastram; somente o administrador edita ou exclui. O codigo do laboratorio e unico e obrigatorio. Ao entrar com esse codigo, o laboratorio escolhe o comprador e agenda na agenda dele.
- A interface mantem IndexedDB como cache e pode oferecer a importacao inicial dos dados locais apos o primeiro login do comprador. O PostgreSQL e a fonte compartilhada entre computadores.
- Retencao automatica (pg_cron, a cada hora, funcao `cleanup_agenda_records`): agendamentos finalizados (concluidos, cancelados ou com atendimento finalizado) sao excluidos 5 dias apos a finalizacao; agendamentos pendentes que nunca foram iniciados sao excluidos 2 dias apos a data agendada. Agendamentos repetitivos nao entram na regra dos pendentes.
- Backups locais existentes continuam disponiveis; planeje tambem backup e restauracao do banco PostgreSQL. A pasta compartilhada antiga nao e usada no fluxo cloud.
- HTTPS e obrigatorio para o uso externo. Restrinja as contas administrativas, desative usuarios desligados e mantenha os codigos de laboratorio unicos.

## Validacao antes de uso real

Execute `npm run check`, confira as variaveis de ambiente e teste com contas descartaveis: dois compradores, uma recepcao e um fornecedor. Verifique isolamento entre compradores, chegada/inicio/finalizacao na recepcao, reserva concorrente do mesmo horario, revogacao de fornecedor, logout/expiracao de sessao e recuperacao de backup.

O servidor usa a connection string somente em codigo de backend, com TLS; nao e necessario expor a chave anon do Supabase no navegador. Este repositorio nao inclui credenciais nem um projeto Supabase/Vercel provisionado. A integracao so fica operacional depois de configurar e publicar esses servicos pela conta autorizada da empresa.