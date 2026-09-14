# Correção do botão Continuar — versão 1.6.1

Backup anterior: backups/antes-correcao-continuar-1.6.0.bundle, commit f4afb7c.
O percurso e as configurações gráficas da versão 1.6.0 foram preservados.

## Falhas reproduzidas e correções

- Quando a preparação falhava, o tour ficava pausado na fase de preparação.
  Continuar só apagava a marca de pausa, sem recomeçar o cálculo. Agora uma
  falha possui estado próprio e Continuar recria o planejador, mantendo o destino.
- Um trajeto indisponível também ficava parado depois de Continuar. A retomada
  recalcula o percurso; uma impossibilidade real permanece informada no painel.
- A seleção VR era decidida pela posição do raio ao soltar a pinça/gatilho.
  A deriva da mão até outro botão podia impedir Continuar. O alvo agora é
  capturado no início do gesto e um mesmo gesto só pode acionar uma opção.
- Falhas de envio, erros do Worker e ausência de resposta encerram a solicitação
  pendente e permitem tentar novamente. Solicitações e temporizadores são
  liberados no cancelamento, na resposta e no erro.
- O painel compacto informa falha na preparação ou trajeto indisponível.

## Verificações antes de publicar

- Os testes de retomada após falha, recálculo de trajeto e deriva da pinça
  falharam com o código anterior e passaram após a correção.
- A suíte completa local passou com 63 testes, incluindo as quatro plantas e
  80 combinações de fachada, garagem e altura. Dois testes adicionais do
  planejador passaram separadamente: timeout e limpeza de solicitações.
- Chrome com WebXR simulado, modelo 69 e lote 12 x 21: falha inicial injetada,
  Continuar pela interface VR, raio deslocado até Pausar antes de soltar,
  evento duplicado no mesmo gesto e verificação de movimento real da câmera.
  O tour avançou da entrada para a sala e prosseguiu para a cozinha.
- Nova pausa e retomada pelo painel compacto, controles completos, próximo,
  anterior, cancelamento no ar, saída e reentrada no VR sem erro de console.
- Produção em /casas-3d/, perfis computador e Quest: falha inicial injetada e
  retomada pelo botão Continuar até o próximo ambiente; quatro modelos, cinco
  fachadas, vistas externas, cancelamento, carregamento e ausência de 404.
- O fluxo de publicação executa 65 testes. O teste do servidor portátil Windows
  é dispensado no executor Linux; foi executado e passou localmente.

Os testes de regressão verificam que a posição avança depois de Continuar,
sem depender apenas de o botão ou a marca Pausado terem mudado.

## Limite da verificação

O estado interno do Quest físico do usuário não foi capturado. Os dois cenários
reproduzidos foram falha de preparação e deriva da seleção. Os testes usam o
WebXRManager real do Three.js no navegador, com poses e entradas simuladas;
não substituem a confirmação de funcionamento ou FPS no aparelho.
Nenhuma luz, efeito, material ou geometria de renderização foi acrescentada.

Reprodução:
npm run build
npm test
node tests/check-immersive-browser.cjs --experiences --model=69 --keep-facade --resume-regression
node tests/check-standalone-browser.cjs --experiences --resume-regression
