# Revisão do tour contínuo — 1.7.0

Data: 15/09/2026. Base preservada: commit 83b3d19; backup completo em
`backups/antes-revisao-tour-1.6.3.bundle`.

## Alterações

- Grade navegável derivada das paredes, pisos, portas e mobiliário de cada planta;
  checagem das arestas entre células e dos segmentos completos em 3D, incluindo
  tetos, telhados e vidro. Curvas locais só são aceitas quando livres.
- Planejamento sequencial de portas: considerar todas abertas simultaneamente
  podia fechar corredores. Agora cada passagem considera sua folha aberta.
- Escolha automática de dobradiça/sentido entre quatro alternativas, preservando
  a posição fechada; limiar da entrada permanece estável ao reconstruir a física.
- Abertura por antecipação de 1,65 m de percurso; espera apenas durante o giro
  necessário e fechamento após liberar a área varrida pela folha.
- Movimento padrão sem pausa nos pontos, 1,15 m/s dentro e 1,9 m/s fora,
  aceleração suave, pequeno deslocamento de revelação dentro dos ambientes.
  Circulação deixa de ser uma apresentação separada; IDs de ambientes não repetem.
- Altura interna de 1,85 m sobre o piso. Banheiros compactos permitem voo acima
  de louças baixas; o volume da câmera continua colidindo com todas as superfícies.
- Trecho externo em elipse próxima ao lote, subida diagonal quando livre,
  vista de fachada/lateral/fundos e retorno por trajetória verificada.
- Recuperação da última posição segura em coordenadas inválidas, colisão ou
  deslocamento inesperado; recuperação da base XR antes de desenhar um quadro
  preto. Pitch e roll continuam exclusivamente controlados pelo headset.
- Box de vidro adicionado em 50 m²; pia e box separados em 60 m², preservando
  a posição do vaso sanitário. Nenhum GLB/arquivo de modelo foi substituído.
- Menu do tour reduzido a Pausar/Continuar e Opções no canto inferior esquerdo
  do VR, com textura de 2048 px. Controles completos no painel existente.
  No computador, painel recolhível no canto inferior direito.

## Verificação

- Tours completos das plantas 50, 60, 62 e 69 m², com geometria real, física de
  portas e atualização da câmera a cada passo; sem pausa automática por falha,
  sem fade e com fechamento das portas após passagem.
- 80 combinações de planta, fachada, garagem e pé-direito: todos os destinos,
  segmentos interiores/exteriores, chegada desde a rua, limites e margens.
- Chrome usando WebGLRenderer e WebXRManager reais com poses sintéticas: cada
  tour completo registrado em imagens, incluindo corredor, quartos, banheiros,
  fachada e terreno. Arquivos locais `tests/full-tour-*-report.json` e PNGs.
- Gestos press/release reais do teste XR, falha simulada do Worker seguida de
  Continuar, pausa, próximo/anterior, cancelamento, saída e reentrada em VR.
- Coordenadas inválidas e deslocamento físico do headset recuperados sem quadro
  preto; orientação nativa do headset preservada.
- Produção servida sob `/casas-3d/`, carregamento dos quatro modelos e cinco
  fachadas, controles de tour e perfil gráfico de computador/Quest, sem erros
  de console ou respostas 404 no teste de navegador.

## Desempenho e limites

A rota permanece em Worker; nenhum servidor adicional. Não foram adicionadas
luzes, sombras, pós-processamento ou reflexos. Permanecem 3 luzes na cena, sombras
Quest desativadas, materiais agrupados e texturas compartilhadas. Os testes de
VR registraram até cerca de 206 draw calls estéreo no tour (dependentes da vista),
13 texturas estáveis. Algumas geometrias de portas são enviadas ao GPU na primeira
vez em que ficam visíveis; não são recriadas a cada quadro.

Esses testes usam poses sintéticas no computador. Não medem FPS, latência ou
conforto no Meta Quest físico. Não foi possível obter depuração direta dos óculos;
portanto não há alegação de FPS garantido no Quest 3/3S. O usuário continua livre
para olhar ao redor e para baixo, sem inclinação artificial da cabeça.

O endereço de publicação permanece https://daniellaureth.github.io/casas-3d/.
O GitHub Actions exige build e testes aprovados antes de publicar `dist`.
Resultado final local: 73 testes aprovados, sem falhas. Verificação adicional do
limiar após troca de dobradiça: aprovada; testes de câmera/física: 15 aprovados.
Registros finais de VR: 34 imagens em 50 m², 38 em 60 m², 48 em 62 m² e 54 em 69 m².
Nenhuma recuperação forçada foi necessária nesses quatro percursos completos.

## Suavidade da câmera — versão 1.7.1

Backup anterior: `backups/antes-suavidade-tour-1.7.0.bundle`.

- Enquadramento estável por ambiente, separado da direção instantânea do deslocamento. Os pontos automáticos ficam do lado de chegada do cômodo, evitando entrar até o canto oposto para depois girar de volta.
- Curvas locais validadas também junto às portas. Quando não há espaço para arredondar, um perfil de velocidade calculado antes do movimento desacelera a câmera para atravessar a curva sem um tranco lateral. Mantém as validações de paredes, móveis e portas.
- Rotação com alvo filtrado, limite de 24 graus/s e aceleração angular de 18 graus/s². Não zera a velocidade angular ao cruzar o alvo nem perde um frame de movimento na troca de ambiente.
- Antecipação do percurso com interpolação por distância, incluindo a próxima etapa; não salta o enquadramento entre vértices da navegação.
- Não acrescenta luzes, materiais, efeitos ou dependências. A preparação continua no Worker. Pitch e roll do headset continuam controlados exclusivamente pela cabeça do usuário.

A simulação completa em passos de 1/60 s reduziu o giro acumulado nas quatro plantas em relação à 1.7.0 (50: 1734° → 855°; 60: 1702° → 1042°; 62: 2268° → 1115°; 69: 2263° → 1191°). Essa métrica verifica giros desnecessários; não é uma medição de conforto ou FPS no Quest físico. O teste de percurso agora verifica também limites de velocidade/aceleração angular, trocas de ambiente e ausência de quinas rápidas durante o deslocamento.

Ajustes futuros em `tour-config.js`: `cornerRadius`, `lateralAcceleration`, `lookAhead`, `turnSpeed`, `turnAcceleration`, `aimSmoothing` e `turnResponse`. Aumentar a suavidade não deve substituir a validação de enquadramento: o cômodo precisa estar visível durante sua apresentação.

Verificação visual da 1.7.1: tours completos com o WebXRManager real e poses simuladas nas quatro plantas; zero recuperação de posição e zero cortina preta. Contadores permaneceram em 3 luzes e 13 texturas, com pico de 174 draw calls estéreo em 50/60 m² e 206 em 62/69 m², iguais à revisão anterior. O pacote de produção passou nos comandos de iniciar/pausar/continuar e na retomada após falha simulada do Worker. A sessão VR também passou em avançar/voltar, encerrar e reentrar.

A comparação quantitativa de movimento acima usa lote de 15 × 30 m. A revisão visual usa os lotes padrão de cada planta, por isso as durações não são diretamente comparáveis. FPS, latência e conforto no Quest físico continuam dependendo de validação no aparelho.
