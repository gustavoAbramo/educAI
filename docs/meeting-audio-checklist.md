# Checklist de captura de reuniao

Use este roteiro antes de uma reuniao real no Google Meet, Microsoft Teams ou similar.

## Configuracoes recomendadas

1. Abra `Configuracoes`.
2. Em `Voz`, selecione `Microfone + reuniao/sistema`.
3. Ative a diarizacao como `Rotulos + nomes` se quiser mapear `speaker_1`, `speaker_2` para participantes depois.
4. Em `Providers locais`, confirme:
   - Faster-Whisper pronto.
   - Smoke de transcricao pronto.
   - Diarizacao pronta, se houver backend real configurado.

## Durante a aula

1. Entre na reuniao normalmente.
2. Inicie a aula no educAI.
3. Permita o microfone quando o navegador pedir.
4. No seletor de compartilhamento, prefira `Aba` e escolha a aba do Meet/Teams.
5. Marque `Compartilhar audio da aba`.
6. Confirme que o painel no topo da aula mostra `Audio da reuniao ativo`.

## Sinais de problema

- `Audio da reuniao ausente`: a aba/tela foi compartilhada sem faixa de audio.
- `Captura da reuniao bloqueada`: permissao negada, seletor cancelado ou navegador bloqueou a captura.
- `Navegador sem captura de aba`: use Chrome ou Edge.
- Somente o microfone foi enviado: o Resultado pode ficar sem as falas dos outros participantes.

## Observacoes importantes

- O navegador nao entrega nomes de participantes a partir do Meet/Teams. O app identifica falantes remotos como `speaker_1`, `speaker_2` e permite associar nomes no Resultado.
- Capturar `Aba` costuma ser mais confiavel que `Tela inteira` ou `Janela`.
- Se a reuniao estiver com fones de ouvido, a captura por aba ainda deve funcionar, desde que `Compartilhar audio da aba` esteja marcado.
