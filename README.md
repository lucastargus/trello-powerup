# Targus | Power-Up de cronogramas e disparos para Trello

Projeto inicial de Power-Up com um botão no quadro: **Criar cards Targus**. O botão abre um modal com duas abas:

1. **Cronograma de conteúdo**: escolhe área/quadro, tipo, lista destino, responsável opcional e até quatro datas de publicação.
2. **Disparo WhatsApp**: cola os números, escolhe quadro/lista e data inicial, seleciona as pessoas e cria um card por dia útil, com até cinco números por checklist e responsável atribuído.

## Antes de instalar

- O código é um ponto de partida configurável. Ele não está ligado à sua conta Trello até você preencher a chave do Power-Up e os IDs reais dos dois quadros.
- A chave `appKey` é a chave do Power-Up. **Não coloque token pessoal do Trello em arquivos ou no GitHub.** A autorização pessoal é administrada pela biblioteca oficial do Power-Up.
- O código não cria listas automaticamente. As listas precisam existir com nomes que correspondam aos configurados.
- As etiquetas são específicas de cada quadro. O programa reutiliza a etiqueta quando ela existe; se não existir, cria uma com a cor configurada. A criação de uma etiqueta não cria uma regra Butler automaticamente. Para os checklists automáticos, a regra precisa estar configurada no mesmo quadro.

## Como funciona a aba Cronograma de conteúdo

- Área **Instagram**: listas esperadas `POST`, `VIDEO`, `STORYS`.
- Área **Prospecção**: listas esperadas `SITE`, `BLOG`, `PROSPECÇÃO ATIVA`.
- Tipos e etiquetas padrão: `POST` → `POST`; `VIDEO` → `VIDEOS`; `STORYS` → `STORYS`; `SITE` → `SITE`; `BLOG` → `BLOG`; `PROSPECÇÃO ATIVA` → `PROSPECÇÃO ATIVA`.
- Você pode preencher até quatro datas. A data escolhida é tratada como **data planejada de publicação**; o prazo do card fica três dias corridos antes, às 9h locais. O título é montado como `TIPO — TEMA — DD/MM/AAAA`; se o tema ficar vazio, `TIPO — DD/MM/AAAA`.
- O card é criado primeiro e a etiqueta é aplicada em uma chamada separada, para que o Trello registre o evento de etiqueta adicionada e a automação existente possa agir. A API não garante que uma regra Butler específica esteja criada ou ativa: teste no quadro antes de usar em escala.

## Como funciona a aba Disparo WhatsApp

- Um número por linha. O programa remove caracteres de formatação, remove repetidos e ignora linhas que não resultem em números de 10 a 13 dígitos. A tela mostra a quantidade de linhas inválidas/repetidas antes da geração.
- São criados `ceil(números/5)` cards; cada um contém checklist `Contatos para disparo` com até cinco números.
- A aba WhatsApp usa o quadro Prospecção. Participantes vêm dos membros desse quadro. Inicialmente, todos aparecem selecionados, em ordem alfabética. Você pode desmarcar pessoas e escolher a pessoa inicial.
- A data inicial vem preenchida com o próximo dia útil. O primeiro card usa a data escolhida (se ela cair no fim de semana, passa para segunda-feira). Cada card seguinte vai para o próximo dia útil e para a próxima pessoa do rodízio; ao chegar ao fim da lista de pessoas, o rodízio recomeça.
- O card tem prazo às 10h locais, é atribuído à pessoa prevista e recebe a etiqueta `PROSPECÇÃO ATIVA` por padrão. Se sua automação não deve rodar para esses cards, ajuste `labelsByType.WHATSAPP` em `public/config.js` antes de publicar.

## Passo a passo de publicação

### 1. Organize os quadros e listas

Confirme que existem os dois quadros de destino. No quadro Instagram, confira `POST`, `VIDEO`, `STORYS`. No quadro Prospecção, confira `SITE`, `BLOG`, `PROSPECÇÃO ATIVA`. Os nomes precisam corresponder aos campos `allowedLists` em `public/config.js`; se seu quadro usa outra grafia, altere ali.

Confirme as etiquetas no quadro Instagram: `VIDEOS`, `POST`, `STORYS`. As regras Butler que adicionam checklists precisam estar ativas **no mesmo quadro** e usar os nomes de etiqueta certos. Para os outros tipos, este projeto criará etiquetas `SITE`, `BLOG` e `PROSPECÇÃO ATIVA` caso ainda não existam; configure regras adicionais separadamente se elas também precisarem de checklist automático.

### 2. Copie os IDs dos quadros

Abra o quadro Instagram. No endereço do navegador, o ID fica no trecho logo depois de `/b/` e antes do próximo `/`. Exemplo ilustrativo: `https://trello.com/b/ABC123/quad ro` → ID `ABC123`. Repita no quadro Prospecção.

Cole os dois IDs nos campos abaixo em `public/config.js`:

```js
boards: {
  instagram: { name: "Quadro Instagram", id: "ID_REAL_DO_INSTAGRAM", allowedLists: ["POST", "VIDEO", "STORYS"] },
  prospeccao: { name: "Quadro Prospecção", id: "ID_REAL_DA_PROSPECCAO", allowedLists: ["SITE", "BLOG", "PROSPECÇÃO ATIVA"] }
}
```

Não use o exemplo fictício; coloque seus IDs reais.

### 3. Publique os arquivos com HTTPS

Um caminho simples é **Cloudflare Pages**:

1. Crie um repositório **privado** no GitHub e envie a pasta `public` e o `README.md` desta pasta do projeto.
2. No Cloudflare, vá a **Workers & Pages → Create → Pages → Connect to Git** e conecte o repositório.
3. Para um site estático sem build: framework preset `None`, deixe o comando de build vazio e defina o diretório de saída como `public`.
4. Conclua o deploy e copie o domínio HTTPS gerado, por exemplo `https://seu-projeto.pages.dev`.
5. Confirme que `https://SEU-DOMINIO/index.html` abre e que `config.js`, `connector.js`, `modal.html`, `modal.js` e `styles.css` carregam.

O repositório pode ser privado, mas o site publicado precisa ser acessível ao Trello via HTTPS. O JavaScript entregue ao navegador não é secreto; por isso, não guarde tokens pessoais nem senhas nele.

### 4. Registre o Power-Up no Trello

1. Acesse `https://trello.com/apps/admin` com uma conta administradora do Workspace.
2. Crie um Power-Up, com nome `Targus | Cronogramas de Marketing`.
3. No campo **Iframe connector URL**, informe `https://SEU-DOMINIO/index.html`.
4. Salve. Na área de autenticação do Power-Up, gere/consulte a **API Key** correspondente a esse Power-Up.
5. Abra `public/config.js`, substitua `COLE_AQUI_A_CHAVE_API_DO_POWER_UP` por essa chave e publique novamente.
6. Em **Capabilities**, ative `board-buttons`.
7. Em configurações/allowed origins do Power-Up, se o portal apresentar esse campo, inclua apenas o domínio publicado, por exemplo `https://seu-projeto.pages.dev`.

### 5. Instale no quadro e autorize

1. No portal de administração do Power-Up, habilite/adicione o Power-Up aos quadros necessários segundo as opções oferecidas pela interface do Trello.
2. Abra um dos quadros e procure o botão `Criar cards Targus`.
3. Na primeira execução de cada usuário, clique em `Conectar ao Trello` e aceite a autorização de leitura e escrita.
4. O usuário precisa ter permissão para editar os quadros de destino; a autorização do Power-Up não substitui as permissões normais do Trello.

### 6. Faça o teste controlado

1. Teste primeiro com uma única data e um tipo `POST` no quadro Instagram.
2. Confirme que o card foi criado na lista correta, com a etiqueta `POST`, prazo três dias antes da data planejada e checklist automática.
3. Teste com 2 ou 3 números de WhatsApp e apenas uma ou duas pessoas selecionadas.
4. Confira nome, responsável, prazo, etiqueta e checklist antes de usar uma lista real de contatos.

## Arquivos

Os arquivos de execução ficam dentro da pasta `public/`:

- `public/index.html`: iframe connector registrado no portal do Trello.
- `public/connector.js`: declara o botão no quadro e abre o modal.
- `public/modal.html`: interface do formulário.
- `public/modal.js`: carrega listas, etiquetas e membros; cria cards, aplica etiquetas e checklists.
- `public/config.js`: chave do Power-Up, IDs dos quadros, listas, etiquetas e regras de datas.
- `public/styles.css`: estilo visual do formulário.
- `public/assets/`: ícones do botão.

## Limitações e observações

- O Power-Up cria cards com a permissão da pessoa que autorizou a integração. Cada pessoa que for usar precisa autorizar uma vez.
- Se a geração terminar parcialmente por falha de rede ou API, a tela informa os cards que falharam; confira o quadro antes de tentar novamente para evitar duplicidade.
- A prevenção de duplicidade usa o nome exato do card na lista de destino. Se um card existente for renomeado, ele pode não ser reconhecido como duplicado.
- Os nomes de lista e etiquetas devem ser adequados ao idioma/grafia usados nos quadros reais.
- O script não envia mensagens de WhatsApp; ele só organiza os contatos em cards e checklists.
