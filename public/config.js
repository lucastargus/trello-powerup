/*
 * CONFIGURAÇÃO DO POWER-UP TARGUS
 *
 * APP_KEY: chave pública do Power-Up gerada no portal de desenvolvedor Trello.
 * Não coloque token pessoal do Trello neste arquivo.
 *
 * O Power-Up agora usa AUTOMATICAMENTE o quadro onde o botão foi clicado,
 * então não é mais necessário informar IDs de quadros.
 */
window.TARGUS_POWERUP_CONFIG = {
  appName: "Targus | Cronogramas de Marketing",
  appKey: "56eadaecd87c7e114cfae18fca0c494b",

  /*
   * Áreas = LISTAS do quadro onde os cards serão criados.
   * listName: nome da lista no Trello (maiúsculas/acentos não importam:
   * "PROSPECCAO" encontra "Prospecção").
   */
  areas: {
    instagram: { name: "Instagram", listName: "INSTAGRAM" },
    prospeccao: { name: "Prospecção", listName: "PROSPECCAO" }
  },

  /* Tipos de card (cada um vira uma etiqueta com o mesmo nome). */
  cardTypes: ["POST", "VIDEO", "STORYS"],

  /*
   * Tipo de card -> etiqueta aplicada no cartão.
   * Se a etiqueta já existir no quadro, é reutilizada; se não, é criada.
   */
  labelsByType: {
    "POST": { name: "POST", color: "orange" },
    "VIDEO": { name: "VIDEO", color: "blue" },
    "STORYS": { name: "STORYS", color: "purple" }
  },

  contentCardsPerBatch: 4,
  publishLeadDays: 3,
  contentDeadlineHour: 9
};
