/*
 * CONFIGURAÇÃO DO POWER-UP TARGUS
 *
 * APP_KEY: chave pública do Power-Up gerada no portal de desenvolvedor Trello.
 * Não coloque token pessoal do Trello neste arquivo.
 *
 * O Power-Up usa AUTOMATICAMENTE o quadro onde o botão foi clicado.
 */
window.TARGUS_POWERUP_CONFIG = {
  appName: "Targus | Cronogramas de Marketing",
  appKey: "56eadaecd87c7e114cfae18fca0c494b",

  /*
   * Cada área corresponde a uma LISTA do quadro (o card sempre vai para ela)
   * e define quais tipos de card podem ser criados nela.
   * Maiúsculas e acentos não importam ("PROSPECCAO" encontra "Prospecção").
   */
  areas: {
    instagram: {
      name: "Instagram",
      listName: "INSTAGRAM",
      types: ["POST", "VIDEO", "STORYS"]
    },
    prospeccao: {
      name: "Prospecção",
      listName: "PROSPECCAO",
      types: ["SITE", "BLOG", "PROSPECÇÃO ATIVA"]
    }
  },

  /*
   * Tipo de card -> etiqueta aplicada no cartão.
   * Se a etiqueta já existir no quadro, é reutilizada; se não, é criada.
   */
  labelsByType: {
    "POST": { name: "POST", color: "orange" },
    "VIDEO": { name: "VIDEO", color: "blue" },
    "STORYS": { name: "STORYS", color: "purple" },
    "SITE": { name: "SITE", color: "green" },
    "BLOG": { name: "BLOG", color: "yellow" },
    "PROSPECÇÃO ATIVA": { name: "PROSPECÇÃO ATIVA", color: "red" }
  },

  contentCardsPerBatch: 4,
  publishLeadDays: 3,
  contentDeadlineHour: 9
};
