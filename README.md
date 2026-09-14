# Casas 3D

Casas interativas em Three.js/WebXR, para computador e Meta Quest 3 / 3S.
Endereço público: **https://daniellaureth.github.io/casas-3d/**

No Quest, abra o endereço HTTPS do GitHub Pages no **Meta Quest Browser**.
Escolha planta e fachada e toque em **Entrar em VR**. Não precisa de computador,
Air Link, Link, servidor local ou assinatura depois da publicação.

- Analógico esquerdo: andar; direito: girar 30° por toque.
- Gatilho: apontar e escolher opções ou abrir/fechar a porta apontada, até 2,5 m.
- B/Y ou botão flutuante Minha casa: opções durante a visita.
- Segure B ou Y por 1,5 segundo para sair, mesmo se o apontamento não responder.
- Fechar: continuar andando. Sair do VR: encerrar a sessão.
- Rastreamento das mãos é opcional; os controles Touch continuam disponíveis.
- Sem controles: feche o painel, estenda uma mão à frente e mantenha o indicador
  apontando na direção desejada. A caminhada começa suavemente. Recolha a mão,
  dobre o indicador ou faça pinça para parar. A pinça continua selecionando opções
  e portas. Colisões permanecem ativas e o painel aberto pausa a caminhada.
- As mãos têm superfícies de pele, palma arredondada e unhas, geradas localmente.
- Normal mantém a escala real. Ampla/Muito ampla alteram a percepção do espaço.

## Atualizar

Os modelos são gerados no próprio `Casas3D.html`; não existem GLBs externos.
Os módulos legíveis `walk-*.js` e `quest-*.js` são a fonte dos recursos de passeio.
Edite esses arquivos e execute `npm run build` e `npm test` com Node 22 ou superior.
O build sincroniza os módulos e gera `dist/index.html` e um arquivo JavaScript
com nome versionado, sem dependências externas. Publique sempre a pasta `dist` inteira.
Envie as alterações para a branch `main`: o GitHub Actions publica a atualização.
Depois, recarregue a página nos óculos. Escolhas de planta/fachada ficam salvas
somente no navegador de cada aparelho; não alteram a configuração dos outros clientes.

## Publicação gratuita

Use um repositório **público** no GitHub Free. Em Settings → Pages → Source,
selecione GitHub Actions. O workflow `.github/workflows/pages.yml` publica apenas
`dist`, com HTTPS fornecido pelo GitHub. O endereço é informado pelo job Publicar.
A página inicial é pequena e mostra a barra enquanto baixa o aplicativo. Modelos e
texturas estão incorporados no JavaScript da mesma publicação. Os caminhos relativos
funcionam sob `/casas-3d/` ou outro nome de repositório, sem configurar Vite/base.
O arquivo local `Casas3D.html` continua completo e portátil. Não há Vite neste projeto.

A barra acompanha os bytes recebidos e as etapas de preparação; chega a 100% somente
depois do primeiro quadro renderizado. Se o download falhar, aparece Tentar novamente.
Na sessão VR, erros de execução ou 20 segundos sem imagem, com o headset ativo,
encerram o passeio e retornam ao navegador. Abrir o menu Meta pausa esse monitoramento.

Para revisão local: `npm run dev`. Para revisar o build: `npm run preview`.
Para conferir a publicação com Chrome no Windows:
`node tests/check-standalone-browser.cjs --url=https://daniellaureth.github.io/casas-3d/`.
Ambos exibem a URL local; isso é apenas desenvolvimento e não é necessário no Quest
depois da publicação. Os atalhos Windows anteriores continuam disponíveis.

## Perfil Quest

Detecção automática de Quest/Oculus Browser em Android; `?quality=quest` permite
inspecionar o mesmo perfil no computador. Sem pós-processamento ou sombras em tempo
real, texturas de superfície limitadas a 512 px, anisotropia 2, vegetação mais leve,
cores agrupadas por vértice e materiais compartilhados na renderização. O painel
mantém sua resolução para legibilidade. WebXR usa resolução 0,8, foveação e solicita
72 Hz somente quando suportado. A projeção da câmera é fornecida pelo headset.

Não há garantia de FPS sem medição nos óculos; o teste no computador não substitui
a validação no Quest. A cabeça atravessando fisicamente uma parede ativa proteção
visual até voltar; encostar nos móveis não escurece a cena. O corpo virtual mantém
colisões com móveis, paredes e portas. Trocas grandes de planta podem pausar brevemente.

Os backups e perfis de navegador são locais e nunca entram na publicação.
