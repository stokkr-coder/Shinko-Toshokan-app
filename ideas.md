# Direção de design — Biblioteca Shinko

## Três abordagens exploradas

| Tema | Introdução breve | Probabilidade |
| --- | --- | --- |
| Catálogo de Gabinete | Um sistema contemporâneo inspirado no cartão catalográfico e na materialidade das bibliotecas particulares: papel, tinta, fichas e índices. A interface transmite controle, memória e cuidado editorial. | 0,07 |
| Oficina Tipográfica | Uma linguagem de pequenos impressos, etiquetas de arquivo e composição tipográfica mecânica. O foco estaria no processo de transformar uma lista bruta em um acervo catalogado. | 0,04 |
| Sala de Leitura Lunar | Um ambiente noturno e contemplativo, com tons de azul-petróleo e mapas celestes discretos para traduzir descoberta e coleção pessoal. | 0,09 |

## Abordagem escolhida — Catálogo de Gabinete

### Movimento de design

**Modernismo editorial com referências a fichários bibliográficos.** A aplicação não simula papel antigo de modo decorativo: usa a lógica de classificação, colunas de registro e marcadores de arquivo para tornar a organização do acervo clara e prazerosa.

### Princípios centrais

1. **A informação é o ornamento.** Identificadores, códigos, números de volume e metadados compõem a hierarquia visual.
2. **Leitura orientada por margens.** Uma coluna lateral persistente e cabeçalhos de seção organizam a navegação sem concentrar toda a experiência em cartões genéricos.
3. **Imperfeição controlada.** Texturas muito sutis, separadores finos e acentos de cor lembram um acervo físico sem comprometer contraste ou legibilidade.
4. **Revisão antes da automação.** Toda inferência do app é apresentada como uma sugestão clara, editável e rastreável.

### Filosofia de cor

O fundo será um **marfim de papel** para reduzir a fadiga de leitura e evocar páginas catalográficas. Tinta grafite e verde-pinheiro conduzem a informação estrutural; o **vermelho-cinábrio** será reservado para ação, pendência e identidade. As cores distinguem confiança e atenção, não enfeitam cada componente.

### Paradigma de layout

Um **fichário horizontal**: barra lateral de coleção à esquerda, faixa de comandos no topo e uma grande mesa de catalogação à direita. As páginas são estruturadas por faixas, divisores e listas, e não por uma grade centralizada de cartões idênticos.

### Elementos de assinatura

1. Uma marca em forma de **monograma “S” construído como lombadas de livros**.
2. Etiquetas de classificação com códigos `ST.0L.55` em tipografia monoespaçada.
3. Filetes assimétricos e marcadores verticais em vermelho-cinábrio que sinalizam a seção ativa ou itens que pedem revisão.

### Filosofia de interação

O aplicativo prioriza ações próximas ao dado: editar uma linha, confirmar uma sugestão e exportar o resultado. Importar, padronizar e adicionar livros devem parecer operações de balcão, não fluxos técnicos. Feedback aparece de forma curta e contextual, com confirmação antes de ações irreversíveis.

### Animação

As transições serão discretas e rápidas: 160–220 ms, usando apenas opacidade e deslocamento curto. As listas entram em cascata com diferenças de 35 ms; painéis de edição surgem como uma ficha que desliza lateralmente. Navegação por teclado, filtros e operações em tabela são instantâneos. O modo de movimento reduzido elimina animações não essenciais.

### Sistema tipográfico

**Fraunces** será usada em títulos e pequenos destaques editoriais, com peso semibold. **IBM Plex Sans** atenderá texto de interface, filtros e formulários. **IBM Plex Mono** será usada exclusivamente para IDs, slugs, volumes e nomes de arquivo. Títulos mantêm um ritmo editorial, enquanto os dados permanecem compactos e verificáveis.

### Essência de marca

**Um catálogo pessoal que transforma uma pilha de arquivos em uma biblioteca digital legível, classificável e pronta para crescer.**

Personalidade: **meticulosa, acolhedora, erudita**.

### Voz da marca

Direta, serena e editorial. Chamadas devem orientar uma ação concreta e reconhecer que o usuário continua no comando, evitando promessas vagas.

> “Converta nomes soltos em registros que você reconhece de relance.”

> “Revise as sugestões; o acervo continua sendo seu.”

### Wordmark e logotipo

O símbolo será uma composição sem texto: uma coluna de três lombadas verticais que, pelo espaço negativo, formam um **S**. Ele funcionará isoladamente no cabeçalho e como favicon; o nome Biblioteca Shinko será composto na tipografia editorial, não como fonte padrão.

### Cor de marca

**Vermelho-cinábrio — `#B84432`**. Uma cor de marca reservada para o marcador de catálogo, ações principais e estados que demandam atenção.

## Style Decisions

As principais superfícies devem ler como registros de catálogo: regras horizontais, índices laterais, códigos monoespaçados e colunas de metadados estabelecem a hierarquia antes de cartões ou ícones. Fotografias de arquivo permanecem integradas à interface por marcas de ficha e etiquetas de classificação. O vermelho-cinábrio fica restrito à marca, ações primárias, seção ativa e sinais de revisão.
