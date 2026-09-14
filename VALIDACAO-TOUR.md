# Tour automático — versão 1.4.1

Backup anterior à revisão: `backups/antes-remover-dia-noite.bundle`.
Base: `da37dd9`. O backup fica local, fora da publicação.

## Alterações desta revisão

- Dia/Noite removido dos controles, da sincronização e dos shaders.
- Iluminação Quest restaurada integralmente do commit `2a1cd39`, anterior ao recurso.
- Botão verde Tour automático no painel inicial do VR e em todas as abas.
- Com tour ativo, esse atalho abre os controles sem reiniciar o percurso.
- O painel compacto, a aba Tour e os controles normais continuam disponíveis.

## Verificações

- Comparação do módulo de iluminação com a versão anterior: conteúdo idêntico.
- Aplicativo gerado sem controles ou shaders Dia/Noite.
- Seleção por raios do botão inicial e dos controles compactos, sem novos objetos na cena.
- Chrome com WebXR simulado: entrar em VR, escolher fachada, iniciar pelo novo
  atalho, pausar, continuar, avançar, medir deslocamento da base, voltar e encerrar.
- Cancelamento durante preparação, saída e reentrada em VR sem erro de console.
- Testes de rotas nas quatro plantas, colisões, orientação nativa da cabeça,
  analógicos, carregamento estéreo e restauração dos controles ao sair.

O teste WebXR usa o gerenciador real do Three.js com poses e sessão simuladas no
Chrome. Ele não substitui a medição de desempenho e conforto no Quest físico.
As novas opções usam o painel existente e não acrescentam luzes ou sombras.

Reproduzir: `npm run build`, `npm test`,
`node tests/check-standalone-browser.cjs --experiences` e
`node tests/check-immersive-browser.cjs --experiences` (Chrome no Windows).
