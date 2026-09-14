# Saída do tour — 1.6.2

Backup: `backups/antes-correcao-saida-1.6.1.bundle` (48cc54e).

## Reprodução e correção

A versão 1.6.1 recusa iniciar o tour de 69 m² no lote 12 × 21 quando a
câmera está um metro à direita e um metro à frente da posição inicial.
A cabeça está livre, mas a margem do corpo de caminhada encosta num obstáculo.
O teste reproduziu `phase: unavailable`, `paused: true`, destino Entrada.
Repetir Continuar recalculava a mesma impossibilidade.

Agora o planejador procura um ponto próximo conectado ao destino e verifica
a ligação em três dimensões com a margem da câmera. O movimento continua
suave, sem teleporte, mantendo paredes, cobertura e portas abertas fora da lente.
A margem normal do percurso e as colisões de caminhada não foram alteradas.

Outra regressão classificava uma cabeça elevada dentro da casa como voo
externo e tentava alcançar a entrada pelo telhado. Dentro da construção, o
percurso agora ajusta a altura por um trecho livre antes das portas.

Os dois testes falharam antes da correção e passaram depois. A verificação de
altura percorre os ambientes das quatro plantas. O teste de saída acompanha
o movimento até sala e cozinha e verifica a proteção contra paredes.

## Reprodução dos testes

```text
npm run build
npm test
node tests/check-immersive-browser.cjs --experiences --model=69 --keep-facade --blocked-start
node tests/check-standalone-browser.cjs --experiences
```

O teste no Chrome usa o Worker e o WebXRManager reais, poses sintéticas com o
deslocamento que reproduz a falha, e seleção pelos controles VR. As verificações
incluem entrada, avanço automático, pausa, retomada, próximo/anterior, vista
externa, cancelamento e saída/reentrada da sessão. O teste de produção serve
o build em `/casas-3d/` e verifica computador e perfil Quest.

Resultados locais: 67 testes aprovados, nenhum erro; 80 combinações de planta,
fachada, garagem e altura verificadas. Os dois testes de navegador passaram,
sem erros de console ou 404. No teste XR de saída, entrada, sala e cozinha
foram alcançadas com o Worker real; depois os controles e a reentrada passaram.

O cálculo adicional acontece na preparação do percurso, fora do renderizador.
Nenhuma luz, sombra, textura, material ou geometria foi acrescentada. FPS e
conforto no Quest físico ainda precisam de confirmação no aparelho; poses e
configuração exatas da falha relatada pelo usuário não foram capturadas.
