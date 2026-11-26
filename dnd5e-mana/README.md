# D&D 5e — Sistema de Mana (Foundry VTT v14 · dnd5e 6.x)

Este módulo troca os **espaços de magia** e os **usos limitados das habilidades de classe** por uma única reserva de **mana**.

## Requisitos
- Foundry VTT **v14** (testado contra a build 370)
- Sistema **dnd5e 6.0+** (escrito sobre o código da 6.1.1)

## Como funciona

### Mana máxima
```
Mana = tabela da(s) classe(s) + bônus de atributo + bônus de espécie + bônus manual
```

**Tabelas por nível de classe** (multiclasse soma a tabela de cada classe no seu próprio nível):

| Nível | Mago¹ | Meio-conjurador² | Guerreiro³ | + Subclasse conjuradora⁴ |
|---:|---:|---:|---:|---:|
| 1 | 4 | 4 | 5 | – |
| 2 | 6 | 4 | 7 | – |
| 3 | 14 | 6 | 9 | 4 |
| 4 | 17 | 6 | 13 | 4 |
| 5 | 27 | 14 | 15 | 4 |
| 6 | 32 | 14 | 17 | 6 |
| 7 | 38 | 17 | 19 | 6 |
| 8 | 44 | 17 | 23 | 6 |
| 9 | 57 | 27 | 25 | 14 |
| 10 | 64 | 27 | 27 | 14 |
| 11 | 73 | 32 | 29 | 14 |
| 12 | 73 | 32 | 33 | 17 |
| 13 | 83 | 38 | 35 | 17 |
| 14 | 83 | 38 | 37 | 17 |
| 15 | 94 | 44 | 39 | 27 |
| 16 | 94 | 44 | 43 | 27 |
| 17 | 107 | 57 | 45 | 27 |
| 18 | 114 | 57 | 47 | 32 |
| 19 | 123 | 64 | 49 | 32 |
| 20 | 133 | 64 | 53 | 32 |

1. Bardo, Bruxo, Clérigo, Druida, Feiticeiro, Mago
2. Paladino, Patrulheiro, Artífice
3. Bárbaro, Guerreiro, Ladino, Monge
4. Cavaleiro Místico, Trapaceiro Arcano (somado à tabela de guerreiro)

Classes que não estão na lista (por exemplo, importadas pelo Plutonium) são classificadas pela progressão de magia que têm no dnd5e.

**Bônus de atributo (INT ou SAB):** `modificador × (nível total ÷ 2, arredondado para cima) × fator`. O fator é **1** para mago, **0,75** para meio-conjurador e **0,5** para guerreiro (vale a categoria mais alta do personagem). Modificador negativo reduz a mana.

O atributo é escolhido em **Configurações → Atributo da mana**:
- **Por classe** (padrão), usando a classe de nível mais alto:
  - **INT:** Mago, Artífice, Guerreiro, Ladino, Bardo, Bruxo
  - **SAB:** Clérigo, Druida, Patrulheiro, Monge, Paladino, Bárbaro, Feiticeiro
- **Inteligência** para todas as classes
- **Sabedoria** para todas as classes
- **O maior** entre os dois

**Bônus por espécie** (`fixo + por nível × nível total`):

| Espécie | Bônus |
|---|---|
| Elfo (e sub-raças), Gnomo, Tiefling, Aasimar | +1 por nível |
| Meio-Elfo | +0,5 por nível |
| Draconato | +3 fixo |
| Humano | +2 fixo |
| Anão, Halfling, Golias, Orc, Meio-Orc | nenhum |

### Custos
**Magias**, pelo círculo do espaço usado (conjurar em círculo maior custa o valor desse círculo):

| Truque | 1º | 2º | 3º | 4º | 5º | 6º | 7º | 8º | 9º |
|---|---|---|---|---|---|---|---|---|---|
| 0 | 2 | 3 | 5 | 6 | 7 | 9 | 10 | 11 | 13 |

**Habilidades de classe com usos limitados** custam mana por uso, e os usos originais deixam de ser gastos. Alguns valores:

| Habilidade | Mana |
|---|---|
| Surto de Ação | 5 |
| Retomar o Fôlego | 2 |
| Indomável | 4 |
| Fúria | 3 |
| Inspiração de Bardo | 2 |
| Canalizar Divindade | 4 |
| Forma Selvagem | 3 |
| Ponto de Foco/Ki | 1 por ponto |
| Ponto de Feitiçaria | 1 por ponto |
| Cura pelas Mãos | 1 a cada 5 PV |
| Intervenção Divina | 10 |
| Outras habilidades | 2 |

Algumas habilidades continuam usando os próprios usos (valor `-1` na tabela): Ataque Furtivo, Recuperação Arcana, Recuperação Natural e Fúria Implacável, entre outras. Habilidades sem usos limitados, como Ação Ardilosa, continuam grátis.

### Descansos
- **Longo:** enche a mana.
- **Curto:** recupera 25% da mana máxima (ajustável).

## Na ficha
A barra azul de **Mana** fica logo abaixo dos PV:
- Clique na barra para digitar um valor (`15`, `+5` ou `-3`).
- A engrenagem mostra de onde vem a mana, permite dar um **bônus manual** e tem o botão **Encher mana**.

Se faltar mana, a magia ou habilidade não é usada e aparece um aviso. O gasto aparece no cartão do chat e pode ser desfeito pelo próprio dnd5e.

## Configurações (Mestre)
- Atributo da mana
- Recuperação no descanso curto (%)
- Traços de espécie gastam mana (desligado por padrão)
- Talentos gastam mana (desligado por padrão)
- Aplicar a NPCs (desligado por padrão)
- **Editar tabelas (JSON):** altera todas as tabelas, custos e bônus acima, com botão para restaurar o padrão.

## API (macros)
```js
const api = game.modules.get("dnd5e-mana").api;
api.getMana(actor);              // { value, max }
api.computeMana(actor);          // detalhamento
api.setMana(actor, 10);
api.restore(actor);              // encher
api.setItemCost(item, 4);        // custo por uso só deste item (-1 = não converter, null = remover)
```
