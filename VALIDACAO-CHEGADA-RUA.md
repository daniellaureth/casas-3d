# Tour partindo da rua — 1.6.3

Backup anterior: `backups/antes-chegada-da-rua-1.6.2.bundle` (bac8e3e).

## Falha identificada pelos prints

As duas imagens mostram o visitante na rua, olhando a casa por fora do muro.
O primeiro destino é Entrada; Próximo muda para Sala de estar sem deslocar a
câmera. Ambos mostram `Trajeto indisponível · Continuar para recalcular`.

Reprodução na versão 1.6.2: nas quatro plantas, posicionar a câmera três metros
à frente do limite frontal do terreno, a 1,70 m de altura. As rotas para Entrada
e Sala retornam null, enquanto todas as ligações internas permanecem válidas.
A classificação considerava apenas altura e tipo do ponto. Como o visitante
estava baixo, procurava uma passagem de caminhada pelo perímetro fechado.

## Correção

O planejador reconhece posições fora dos limites reais do lote como origem ou
destino externo, inclusive na altura de uma pessoa. Reutiliza a chegada aérea
existente: subida, passagem acima das obstruções, descida num ponto interno com
espaço livre e continuação pelos cômodos. Todos os segmentos permanecem
verificados contra paredes e cobertura. Não há teleporte, corte ou fade novo.

Colisões manuais, modelos, iluminação, materiais, menus e velocidade permanecem
iguais. A mudança só afeta o planejamento, executado no Worker.

## Verificações

- O novo teste da chegada pela rua falhou antes da correção e passou depois.
- As quatro plantas saem da rua e avançam automaticamente por Entrada e Sala
  até Cozinha, sem pausa automática ou câmera atravessando paredes.
- As 80 combinações existentes de planta, fachada, garagem e altura também
  verificam agora as ligações da rua até Entrada e Sala, com a física serializada
  como no Worker, além de todo o itinerário interno/externo.
- O teste no Chrome usa uma origem XR na rua sem mudar a entrada da planta.
  A seleção VR aciona o Worker real; pausa e retomada verificam deslocamento
  efetivo, seguidas de avanço automático aos cômodos e saída/reentrada de VR.

Resultado local: 68 testes passaram, sem falhas. Os dois testes de navegador
também passaram, incluindo produção, carregamento, controles e ausência de
erros de console. Capturas locais: `tests/immersive-street-arrival.png` e
`tests/immersive-street-inside.png`.

```text
npm run build
npm test
node tests/check-immersive-browser.cjs --experiences --model=69 --keep-facade --street-start
node tests/check-standalone-browser.cjs --experiences
```

Os testes de navegador usam WebGL e WebXRManager reais com poses sintéticas.
Os prints permitiram reproduzir a condição geométrica relatada; a posição
numérica exata e o FPS no aparelho físico não foram medidos.
