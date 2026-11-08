/* JeruServices — réglages et petit code commun à toutes les pages.
   ======================== RÉGLAGES (à modifier ici seulement) ======================== */
var JERU = {
  // Numéro WhatsApp au format international, chiffres seulement (ex. "972501234567").
  // VIDE = numéro pas encore connu : les boutons WhatsApp affichent « bientôt disponible ».
  // Numéro provisoire +1 807-790-4127 (en attendant la vérification de l'entreprise par Meta ; +1 555 en réserve).
  whatsapp: "18077904127",
  // Langues proposées dans le sélecteur. Ajouter "he" quand la traduction hébraïque est prête et relue.
  langues: ["fr", "en"],
  // Message pré-rempli dans WhatsApp, par langue.
  messageWhatsapp: {
    fr: "Bonjour ! Je souhaite réserver un ménage",
    en: "Hello, I would like to book a cleaning.",
    he: "שלום, אני רוצה להזמין ניקיון."
  }
};
/* ===================================================================================== */

(function () {
  var html = document.documentElement;

  function choisirLangue() {
    var demandee = null;
    try { demandee = new URLSearchParams(location.search).get("lang"); } catch (e) {}
    if (demandee && JERU.langues.indexOf(demandee) !== -1) return demandee;
    try {
      var memo = localStorage.getItem("jeru-lang");
      if (memo && JERU.langues.indexOf(memo) !== -1) return memo;
    } catch (e) {}
    var nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    if (JERU.langues.indexOf(nav) !== -1) return nav;
    return "fr";
  }

  function appliquer(lang) {
    html.setAttribute("data-lang", lang);
    html.setAttribute("lang", lang);
    html.setAttribute("dir", lang === "he" ? "rtl" : "ltr");
    try { localStorage.setItem("jeru-lang", lang); } catch (e) {}
    var titre = html.getAttribute("data-title-" + lang);
    if (titre) document.title = titre;
    var boutons = document.querySelectorAll("[data-lang-btn]");
    for (var i = 0; i < boutons.length; i++) {
      boutons[i].setAttribute("aria-pressed", boutons[i].getAttribute("data-lang-btn") === lang ? "true" : "false");
    }
    liensWhatsapp(lang);
  }

  function liensWhatsapp(lang) {
    var liens = document.querySelectorAll("[data-wa]");
    for (var i = 0; i < liens.length; i++) {
      var a = liens[i];
      if (JERU.whatsapp) {
        var texte = encodeURIComponent(JERU.messageWhatsapp[lang] || JERU.messageWhatsapp.fr);
        a.href = "https://wa.me/" + JERU.whatsapp + "?text=" + texte;
        a.removeAttribute("aria-disabled");
        a.classList.remove("wa-attente");
      } else {
        a.href = "#numero-whatsapp-a-venir";
        a.setAttribute("aria-disabled", "true");
        a.classList.add("wa-attente");
      }
    }
    var attente = document.querySelectorAll("[data-wa-attente]");
    for (var j = 0; j < attente.length; j++) attente[j].hidden = !!JERU.whatsapp;
  }

  // Appliqué tout de suite (le script est chargé dans <head>) pour éviter un clignotement de langue.
  html.setAttribute("data-lang", choisirLangue());

  document.addEventListener("DOMContentLoaded", function () {
    var boutons = document.querySelectorAll("[data-lang-btn]");
    for (var i = 0; i < boutons.length; i++) {
      var b = boutons[i];
      if (JERU.langues.indexOf(b.getAttribute("data-lang-btn")) === -1) { b.hidden = true; continue; }
      b.addEventListener("click", function () { appliquer(this.getAttribute("data-lang-btn")); });
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-wa][aria-disabled='true']") : null;
      if (a) e.preventDefault();
    });
    var an = document.querySelectorAll("[data-annee]");
    for (var k = 0; k < an.length; k++) an[k].textContent = new Date().getFullYear();
    appliquer(html.getAttribute("data-lang"));
  });
})();
