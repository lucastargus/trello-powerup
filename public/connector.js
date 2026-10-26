(function () {
  "use strict";

  const cfg = window.TARGUS_POWERUP_CONFIG;
  const absolute = (path) => new URL(path, window.location.href).href;
  // Tema claro do Trello -> logo preta; tema escuro -> logo branca.
  // Arquivos em: public/assets/logo_black.png e public/assets/logo_white.png
  const iconLight = absolute("./assets/logo_black.png");
  const iconDark = absolute("./assets/logo_white.png");

  window.TrelloPowerUp.initialize({
    "board-buttons": function (t) {
      return [{
        icon: { light: iconLight, dark: iconDark },
        text: "Criar cards Targus",
        condition: "edit",
        callback: function (boardT) {
          const modalUrl = boardT.signUrl(absolute("./modal.html"));
          return boardT.modal({
            title: "Targus | Criar cards",
            url: modalUrl,
            accentColor: "#ea4d33",
            fullscreen: false,
            size: "medium"
          });
        }
      }];
    }
  }, {
    appKey: cfg.appKey,
    appName: cfg.appName
  });
})();