# Tour guiado e aéreo — versão 1.5.0

Backup antes da alteração: backups/antes-tour-muro-menu.bundle, baseado em dcca4e3.
O arquivo permanece local e não integra a publicação.

## Alterações

- Tour move a posição diretamente, sem gravidade ou bloqueio por móveis baixos.
  A caminhada manual continua usando a física original.
- O planejador mantém distância de paredes, vidros, portas abertas e armários
  altos. Cada cômodo existente recebe uma parada; caminhos desconectados usam
  uma transição com imagem completamente escurecida, sem omitir o cômodo.
- Início pela entrada em todas as plantas. Portas abrem automaticamente.
- Três vistas aéreas mostram fachada, lateral e quintal, com posições proporcionais
  ao lote e altura suficiente para enquadrá-lo acima de todos os telhados/garagens.
- Transição de altitude somente sob fade, retorno ao chão no fim ou cancelamento.
- Velocidade 0,85 m/s, aceleração/desaceleração, pausas e controles preservados.
- A cabeça permanece nativa no WebXR; só o computador enquadra automaticamente
  as vistas aéreas, mantendo a possibilidade de olhar com o mouse.
- Menu VR: duas texturas de 2048 pixels, texto mais legível, painel ligeiramente
  maior e redução da foveação quando as opções estão abertas. Contador de paradas.
- Dia/Noite permanece removido. Nenhuma alteração na iluminação da casa.

## Verificações

- Percurso completo nas quatro plantas: todos os cômodos e três vistas aéreas,
  retorno ao chão, limite de velocidade e câmera fora das paredes.
- 80 combinações: quatro plantas, cinco fachadas, garagem sim/não, sala alta sim/não.
  Todas preservam a lista completa de paradas e vistas dentro do lote real.
- Regressão com móvel bloqueando a caminhada e parede separando completamente
  os ambientes: o tour visita o destino com fade e devolve controle em local livre.
- Sessões WebXR com o gerenciador real do Three.js e poses simuladas: tour completo
  nas quatro plantas com movimento contínuo de cabeça, sem clicar em Próximo.
- Chrome/WebGL, planta 69 m² e lote 12 x 21, sem mudar fachada para preparar a cena:
  avanço automático, pausa, continuar, próximo/anterior, trecho aéreo, cancelar
  no ar, sair e entrar novamente em VR. Console sem erros.
- Build de produção em /casas-3d/: quatro modelos, cinco fachadas, modo desktop
  e perfil Quest; tour e vistas aéreas, cancelamento, altura de caminhada,
  botão WebXR, caminhos relativos e ausência de erros de rede/console.
- Inspeção visual dos menus e das vistas aéreas em capturas reais do navegador.

## Desempenho e limites

O aplicativo continua em aproximadamente 1,55 MiB, sem downloads de modelos extras.
O tour não cria luzes, materiais ou objetos por quadro. O cálculo do percurso
continua em Worker. Permanecem as três luzes existentes e sombras desativadas em VR.
A contagem de texturas e objetos não aumenta ao repetir a sessão/tour.
As duas texturas maiores do menu usam aproximadamente 11 MiB adicionais de memória
RGBA em relação às anteriores com mipmaps; a foveação retorna ao perfil leve ao
fechar as opções (0,5 durante o tour e 1 na caminhada livre).

As vistas aéreas podem exibir mais objetos simultaneamente que um cômodo. Os
ensaios no computador verificam código, recursos e renderização, mas não medem
FPS, conforto ou latência no Quest físico. A confirmação no aparelho continua
necessária; não se afirma desempenho de hardware com base na simulação.

Reprodução: npm run build; npm test;
node tests/check-immersive-browser.cjs --experiences --model=69 --keep-facade;
node tests/check-standalone-browser.cjs --experiences.
