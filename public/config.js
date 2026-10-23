/*
 * CONFIGURAÇÃO DO POWER-UP TARGUS
 *
 * APP_KEY: chave pública do Power-Up gerada no portal de desenvolvedor Trello.
 * IDs dos quadros: copie o trecho do endereço do quadro entre /b/ e o próximo /
 * Não coloque token pessoal do Trello neste arquivo.
 */
window.TARGUS_POWERUP_CONFIG = {
  appName: "Targus | Cronogramas de Marketing",
  appKey: "56eadaecd87c7e114cfae18fca0c494b",

  boards: {
    instagram: {
      name: "Quadro Instagram",
      id: "PvAjE6xi",
      allowedLists: ["POST", "VIDEO", "STORYS"]
    },
    prospeccao: {
      name: "Quadro Prospecção",
      id: "PP9EU4R4",
      allowedLists: ["SITE", "BLOG", "PROSPECÇÃO ATIVA"]
    }
  },

  /*
   * Tipo de card -> nome exato da etiqueta que será aplicada no cartão.
   * Os 3 primeiros nomes foram definidos pelo usuário.
   * Para Site, Blog e Prospecção Ativa, este projeto usa etiquetas de mesmo nome.
   * Se as etiquetas já existirem no quadro, o programa reutiliza-as.
   * Se não existirem, ele as criará automaticamente.
   */
  labelsByType: {
    "POST": { name: "POST", color: "orange" },
    "VIDEO": { name: "VIDEO", color: "blue" },
    "STORYS": { name: "STORYS", color: "purple" },
    "SITE": { name: "SITE", color: "green" },
    "BLOG": { name: "BLOG", color: "yellow" },
    "PROSPECÇÃO ATIVA": { name: "PROSPECÇÃO ATIVA", color: "red" },
    "WHATSAPP": { name: "PROSPECÇÃO ATIVA", color: "red" }
  },

  contentCardsPerBatch: 4,
  contactsPerWhatsappCard: 5,
  publishLeadDays: 3,
  whatsappStartHour: 10,
  contentDeadlineHour: 9
};
