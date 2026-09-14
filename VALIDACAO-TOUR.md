# Tour contínuo para o cliente sentado — versão 1.6.0

Backup anterior: backups/antes-tour-sentado-1.5.0.bundle, commit 5c3bf24.
O backup permanece local e não integra a publicação.

## Comportamento

- Percurso contínuo em todas as plantas, passando pelas portas e pelos ambientes.
  Não há teleporte nem escurecimento entre os cômodos ou nas mudanças de altura.
- Curvas arredondadas e verificadas contra paredes. A câmera flutua sobre móveis
  baixos e evita paredes, vidros, folhas de portas abertas e armários altos.
- A saída para o terreno acontece por uma rota até um ponto livre de cobertura.
  O tour sobe nesse ponto, passa acima dos telhados, desce ao contorno do lote,
  apresenta fachada, espaço lateral e quintal e retorna à entrada.
- Altura interna aproximada de 1,95 m, velocidade máxima de 0,8 m/s e aceleração
  de 0,5 m/s². A rotação horizontal tem limite de 18°/s e aceleração gradual.
- Enquadramento dos cômodos à frente da cadeira. A direção neutra é capturada
  ao iniciar; movimentos da cabeça continuam nativos, incluindo pitch e roll.
  O giro do tour acontece ao redor dessa referência fixa, sem acumular desvios.
- Pausar, continuar, próximo, anterior, encerrar, menu e saída do VR preservados.
  A caminhada manual conserva suas colisões e seus controles.
- Ao cancelar no ar, o visitante é devolvido ao chão e a um ponto livre; no VR,
  somente essa recuperação solicitada pelo usuário mantém uma cortina breve.
  A proteção existente contra encostar fisicamente a cabeça na parede permanece.
- Se uma alteração futura da planta impedir um trajeto, o painel informa a
  passagem indisponível, sem omitir destinos nem atravessar a parede.
- Dia/Noite permanece removido. Não foram alteradas iluminação ou sombras.

## Validação

- Quatro plantas completas com todos os cômodos, três vistas externas e retorno.
  Verificação de velocidade, altura, ausência de cortes e de paredes no percurso.
- 80 combinações de planta, fachada, garagem e altura de sala: todas as conexões
  contínuas disponíveis; arcos externos e subida/descida livres dos telhados.
- Gerenciador WebXR real do Three.js com poses simuladas: as quatro plantas
  completam o tour com a cabeça em movimento. Teste específico sentado, com
  movimentos de até 90° para cada lado, sem substituir a orientação do headset.
- Chrome/WebGL, planta 69 m² no lote 12 x 21, perfil Quest, altura sentada:
  entrada automática, todos os cômodos, inspeção visual, vista externa, pausa,
  continuar, próximo/anterior, cancelamento no ar, saída e reentrada no VR.
  Console sem erros. A simulação mantém frames mesmo com a janela em segundo plano.
- Produção em /casas-3d/: quatro modelos e cinco fachadas nos perfis computador
  e Quest; tour, câmera, controles, botão VR e arquivos sem erros de rede/404.
- Mouse continua livre no tour do computador. Reiniciar captura a direção atual
  sem duplicar o deslocamento do mouse; a caminhada volta ao encerrar.
- Suíte automatizada de 60 testes no fluxo de publicação.

## Desempenho e limites

Aplicativo autocontido com aproximadamente 1,56 MiB, sem modelos ou bibliotecas
adicionais. O cálculo dos caminhos e das curvas fica no Worker. O avanço não
cria luzes, materiais ou geometrias por quadro. Permanecem as três luzes da cena,
sem sombras em VR, e os mesmos níveis de resolução/foveação.

No ensaio da planta 69 em VR, entrar novamente retornou aos mesmos 873 recursos
de geometria, 13 texturas e 22 programas de shader. O tour não acrescentou recursos
persistentes de renderização. Os números são do navegador de teste, não medidas
de memória total do dispositivo. As vistas externas podem desenhar mais objetos
que os interiores. Os testes de computador não comprovam FPS, latência ou
conforto no Quest físico; esses pontos dependem da avaliação no aparelho.

Configuração editável: tour-config.js. Publicação no mesmo endereço:
https://daniellaureth.github.io/casas-3d/

Reprodução:
npm run build
npm test
node tests/check-immersive-browser.cjs --experiences --model=69 --keep-facade --seated-shots
node tests/check-standalone-browser.cjs --experiences
