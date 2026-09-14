# Tour e Dia/Noite — versão 1.4.0

Backup anterior às alterações: `backups/antes-tour-dia-noite-20260914.bundle`,
base `2a1cd39`. O backup fica local, fora da publicação.

## Verificações

- Build de produção com assets incorporados e caminhos sob `/casas-3d/`.
- Testes de colisão nas quatro plantas mobiliadas: todos os percursos completos,
  sem atravessar paredes/móveis, abrindo portas e com velocidade máxima de 0,85 m/s.
- Chrome/WebGL real, build de produção, perfis desktop e Quest: quatro plantas,
  cinco fachadas, Dia, Noite, início, pausa, continuação, próximo, anterior,
  encerramento, reinício e troca da iluminação durante o tour.
- WebXR com o gerenciador real do Three.js e poses/sessão simuladas: carregamento
  estéreo, gatilhos no painel, operações do tour, mudança Dia/Noite, cancelamento
  durante a preparação, saída e reentrada em VR. Nenhum erro de console observado.
- Teste de yaw, pitch e roll: a orientação continua vindo do rastreamento; o tour
  desloca apenas a base. Analógicos não interferem enquanto o tour está ativo.
- O menu Meta suspende o avanço. Botões compactos do tour recebem os mesmos raios
  de seleção do painel principal; não acrescentam objetos à cena.

## Custo gráfico observado

Comparações com a mesma câmera/casa antes e depois da transição:

| Cenário | Draw calls Dia / Noite | Luzes | Geometrias | Texturas | Programas |
| --- | --- | --- | --- | --- | --- |
| Desktop, planta 69 | 408 / 408 | 3 / 3 | 207 / 207 | 35 / 35 | 33 / 33 |
| Perfil Quest, planta 69, sem VR | 107 / 107 | 3 / 3 | 106 / 106 | 11 / 11 | 13 / 13 |
| Perfil Quest, estéreo simulado, planta 50 | 172 / 172 | 3 / 3 | 88 / 88 | 11 / 11 | 14 / 14 |

São as três luzes já existentes. À noite, a luz direcional de preenchimento fica
com intensidade zero. Nenhuma PointLight/SpotLight, sombra ou pós-processamento
foi acrescentado. Sombras no perfil Quest continuam desativadas.

Dia/Noite reutiliza materiais, geometrias e um uniform compartilhado. Acrescenta
atributos de cor preparados uma vez por geometria; portanto existe custo adicional
de armazenamento desses atributos em relação à versão anterior. Alternar os modos
não aumenta os contadores de recursos GPU acima. Esses contadores não são uma
medição completa da memória RAM/VRAM em bytes.

Rotas são calculadas em um Worker, inclusive ao avançar/voltar manualmente.
O tour usa trajetos já calculados durante a animação; o Worker é encerrado e sua URL
liberada ao cancelar/sair. O módulo de movimento reutiliza o corpo de colisão.
Não são criadas novas luzes ou materiais por quadro pelas duas funções.

## Limite da validação

As sessões automatizadas usam Chrome no notebook, inclusive quando simulam WebXR.
Não medem FPS, latência ou conforto em um Quest físico. `casaDebug().vr.fps` permite
inspecionar a frequência média durante uma sessão real, excluindo carregamento e
intervalos longos. A fluidez percebida nos Quest 3/3S ainda requer teste nos óculos.

Reproduzir: `npm run build`, `npm test`,
`node tests/check-standalone-browser.cjs --experiences` e
`node tests/check-immersive-browser.cjs --experiences` (Chrome no Windows).
