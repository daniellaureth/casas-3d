# Casas 3D

Casas interativas em Three.js/WebXR, para computador e Meta Quest 3 / 3S.
Endereço público: **https://daniellaureth.github.io/casas-3d/**

No Quest, abra o endereço HTTPS do GitHub Pages no **Meta Quest Browser**.
Escolha planta e fachada e toque em **Entrar em VR**. Não precisa de computador,
Air Link, Link, servidor local ou assinatura depois da publicação.
Ao entrar, uma tela de carregamento aparece **dentro dos dois olhos do VR**.
Ela prepara a casa, a iluminação e os shaders; chega a 100% somente depois de
renderizar a primeira imagem da casa. Então o painel de opções aparece ao alcance.
O botão Sair do VR funciona também durante essa preparação.

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

### Tour automático

Na barra superior, **Tour automático** inicia o passeio em primeira pessoa.
O painel **Tour da casa** mostra o ambiente, Pausar, Continuar, Próximo ambiente,
Ambiente anterior e Encerrar tour. No computador, P pausa/continua e Esc encerra.
No VR, use o botão verde **Tour automático** no painel inicial. Ele também aparece
em todas as abas; **Minha casa → Tour** reúne os controles completos. Durante o passeio, o botão Minha casa se transforma
no painel compacto do tour; **Opções** reabre o menu completo.

O tour foi pensado para o cliente sentado, olhando até 90° para cada lado.
Ao iniciar, sente-se olhando à frente: essa direção vira a referência da visita.
A base percorre a casa a 0,8 m/s, com aceleração e parada suaves, e conduz também
o enquadramento horizontal. Os cômodos são apresentados à frente do visitante.
A cabeça continua livre: pitch e roll do headset nunca são alterados. Caminhada
manual e giro pelo analógico ficam suspensos até
encerrar o tour; menu e saída do VR continuam disponíveis. As portas necessárias
abrem automaticamente. O tour flutua sobre os móveis baixos, contorna paredes e
evita colocar a câmera dentro de armários altos. A caminhada manual mantém sua física.
O voo é contínuo: curvas locais suavizadas passam pelas portas, sem cortes nem
escurecimento entre cômodos. A rotação horizontal tem limite de 18°/s e aceleração
gradual. A referência da posição é o olhar neutro sentado, capturado uma vez,
evitando acumular desvios ao olhar para os lados nas curvas.
A altura virtual nos interiores é de aproximadamente 1,95 m sobre o piso,
independentemente de o visitante estar sentado. O rastreamento continua livre.
Sair do VR ou trocar a planta encerra o tour. Abrir o menu do sistema Meta suspende
o avanço enquanto a sessão estiver sem foco.

A visita começa na entrada e percorre todos os ambientes disponíveis. Depois,
um voo baixo e afastado contorna o lote, mostrando fachada, espaço lateral e quintal.
O tour sai pela entrada e sobe em um ponto livre de cobertura; o deslocamento
até o contorno passa acima dos telhados. As vistas do terreno ficam a cerca de
3,8–4,5 m, com a casa à frente. A subida e a descida são visíveis e graduais.
O cliente não precisa procurar a casa atrás de si ou olhar quase para o chão.
O percurso termina de volta ao chão. Encerrar também devolve a uma posição livre
para caminhar. Se uma planta modificada não tiver uma conexão livre, o painel
informa a passagem indisponível e permite avançar ou encerrar; não teleporta.
No computador, o mesmo enquadramento guiado permite olhar com o mouse.
Continuar retoma uma pausa normal e, em caso de falha de preparação, recria
o planejador e tenta o mesmo destino novamente. A seleção VR acompanha o
botão apontado no início da pinça/gatilho, mesmo que a mão se mova ao soltar.
O painel mostra a etapa atual e o total de paradas. Os textos do menu VR usam
texturas de 2048 pixels e menos redução de qualidade enquanto o painel está aberto.

Edite **`tour-config.js`** para ajustar o percurso: `stops` define a ordem dos
ambientes, `room` busca o nome na planta e `label` define o texto exibido. Ambientes
ausentes são ignorados. `u` e `v` escolhem a posição proporcional dentro do cômodo
(0 a 1). Sem essas coordenadas, o tour escolhe um ponto próximo da borda do cômodo
para mostrar o interior à frente. `focusU`/`focusV` escolhem a região apresentada.
`kind: 'aerial'` cria uma vista externa: `angle` define a posição no contorno do lote
em graus (0 = frente, 90 = direita, 180 = fundos). A distância se adapta ao lote.
`eyeHeight` define a altura interna (limitada a 2 m), `exteriorHeight` a altura
externa mínima, `turnSpeed` a velocidade máxima de giro visível em graus/s e
`turnAcceleration` a aceleração angular. `cornerRadius` ajusta o arredondamento
das curvas (reduzido automaticamente quando houver uma parede próxima).
`dwell` define os segundos em cada parada (padrão 5), `speed` a velocidade e
`start: 'entry'` mantém a sequência completa desde a entrada. O valor opcional
`nearest` começa no ambiente mais próximo.
Exemplo de ajuste só para a planta de 50 m²:

```js
models: { '50': { kitchen: { u: 0.5, v: 0.7, dwell: 5 } } }
```

A iluminação anterior foi restaurada na versão 1.4.1; Dia/Noite foi removido.
O cálculo das rotas usa um Worker local para preservar a resposta da renderização.
Nenhum servidor adicional ou serviço externo é necessário.

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
Essa barra inicial da página é independente do carregamento dentro do VR.
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

No VR standalone, a casa usa iluminação difusa calculada nos vértices, mantendo
cores e texturas sem depender dos shaders PBR de iluminação/reflexos do aparelho.
Reflexos e relevo fino dos materiais ficam simplificados nesse modo. A luz de
entardecer continua disponível. Geometrias e materiais originais são restaurados
ao sair, preservando a renderização do computador. O painel se reposiciona caso
um recentramento ou deslocamento físico o deixe distante demais.

Não há garantia de FPS sem medição nos óculos; o teste no computador não substitui
a validação no Quest. A cabeça atravessando fisicamente uma parede ativa proteção
visual até voltar; encostar nos móveis não escurece a cena. O corpo virtual mantém
colisões com móveis, paredes e portas. Trocas grandes de planta podem pausar brevemente.

Os backups e perfis de navegador são locais e nunca entram na publicação.
