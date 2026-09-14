# Análise e validação — Quest standalone

## Estrutura encontrada antes das alterações

- Aplicação portátil HTML/CSS/JavaScript, biblioteca Three.js r180 incorporada.
  O HTML contém vestígios de um bundle antigo, mas não havia fontes de framework,
  package.json, configuração Vite nem pipeline de build disponível.
- Entrada atual: Casas3D.html, 1.589.918 bytes antes das alterações. Cópia antiga
  independente em Casas-3D/Casas3D.html, 1.523.607 bytes, preservada.
- 4.975.839 bytes de arquivos do projeto, testes e imagens de teste, excluindo
  perfis de navegador. Os perfis são dados locais do navegador e não são assets.
- Quatro plantas procedurais: 50, 60, 62 e 69 m²; cinco estilos de fachada.
  Geometrias, mobiliário, terreno, vegetação e portas são construídos em JavaScript.
- Não há GLB/GLTF, GLTFLoader, Draco, Meshopt ou arquivos de modelos a recomprimir.
- Quatro JPEGs incorporados: grassColor (212.209 bytes), grassNormal (270.034),
  oakColor (105.142), oakNormal (19.993), todos 768 × 768. Outras texturas são
  DataTextures procedurais de 256 × 256. Não existem requisições externas de assets.
- Colisões: corpo circular de 20 cm, caixas de paredes/móveis, portas rotativas,
  altura dos olhos 1,65 m, gravidade, degraus e deslizamento junto às paredes.
- Portas: origem na dobradiça, folha animada e cópia articulada na cena agrupada.
- WebXR já usava immersive-vr, local-floor, rig do visitante, dois controles,
  setAnimationLoop, analógicos, painel interno e mãos opcionais.
  A interação anterior com portas dependia da direção da cabeça.
- Iluminação: céu procedural, hemisférica e duas direcionais; ambiente PMREM
  pré-calculado uma vez. Materiais PBR e vidro transparente, sem reflexão por quadro.
- Desktop: sombra direcional 2048, atualizada sob demanda, GTAO, bloom, SMAA e
  saída tonal na vista geral. Passeio e VR já usavam renderização direta;
  sombras eram desligadas durante VR, mas os efeitos ainda eram alocados na abertura.
- Já havia agrupamento por material, mantendo portas separadas e móveis opcionais.
- Backup anterior às mudanças: backups/antes-quest-standalone-20260914-132025.zip
  SHA256 C9E5BFACDE6556DD75BE05DFD3A95FECDE656A9A8255629407A86B185C5F2257.

## Alterações

Mantida a arquitetura portátil. Novo build Node sem dependências copia somente a
entrada autossuficiente para dist/index.html e gera metadados de versão. Funciona
em qualquer subpasta de GitHub Pages. Workflow de publicação em main, com HTTPS.

Perfil Quest automático: sem alocar pós-processamento e sem sombras em tempo real;
shadow maps limitados a 512 caso utilizados posteriormente; resolução de superfícies
512, anisotropia 2, árvores com menos subdivisões, faixas da rua instanciadas.
Mantidos o ambiente pré-calculado e a iluminação atual. Mãos já usam instancing.
As texturas originais ficam intactas; redução somente em memória nos óculos.
Não foi adicionado KTX2/Draco: exigiria novo carregador/decodificador para recursos
que já estão incorporados e são pequenos. Não há modelo GLB que se beneficie de Draco.

Cores opacas são transferidas para vértices apenas na cena agrupada do Quest,
permitindo reutilizar materiais. UVs, normais, reflexos, emissivos e transformações
das texturas permanecem distintos quando necessário. Materiais da animação original
continuam independentes; descarte dos materiais temporários evita acúmulo nas trocas.

Controles Touch: movimento esquerdo, giro direito de 30°, gatilho com raycast exato
da folha rotativa e bloqueio por obstáculos; painel B/Y e botão Sair do VR. Perfil
Quest calibra altura inicial em 1,65 m uma única vez; movimento da cabeça e projeção
estéreo seguem o runtime. Resolução XR 0,8 e foveação; solicita 72 Hz se suportado.

## Medições no navegador do computador, com perfil Quest

| Planta | Peças antes de agrupar | Grupos desktop | Grupos Quest |
| --- | ---: | ---: | ---: |
| 50 | 585 | 120 | 35 |
| 60 | 619 | 120 | 37 |
| 62 | 725 | 141 | 51 |
| 69 | 711 | 144 | 52 |

Esses números são da casa agrupada; cenário, painel, transparências e duas vistas
estéreo têm custos adicionais. Não representam FPS medido no Quest.

Testes automatizados verificam colisões, portas, acessibilidade dos ambientes,
painel, mãos, continuidade da sessão, restauração da câmera, perfil gráfico,
agrupamento e produção sob /casas-3d/. Testes em Chrome real verificam os quatro
modelos e as cinco fachadas nos perfis desktop e Quest, erros de console/WebGL/rede,
botão de entrada e presença de WebXR. O primeiro 404 do favicon foi corrigido com
um ícone incorporado. Evidências locais: tests/standalone-*-report.json e PNGs.

A validação de entrada, FPS, conforto e controles no dispositivo standalone exige
abrir o link publicado no Quest. Emulação de user agent não simula sua GPU ou runtime.

Referências oficiais: [Meta WebXR](https://developers.meta.com/horizon/documentation/web/),
[desempenho](https://developers.meta.com/horizon/documentation/web/webxr-perf/),
[GitHub Pages com Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
