(function () {
  "use strict";

  const cfg = window.TARGUS_POWERUP_CONFIG;
  const absolute = (path) => new URL(path, window.location.href).href;

  // Ícones laranja (public/assets/)
  const iconLight = absolute("./assets/targus-icon-dark.svg");
  const iconDark = absolute("./assets/targus-icon-light.svg");

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