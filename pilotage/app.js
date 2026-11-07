/* JeruServices – Pilotage : Mini App Telegram (sans bibliothèque). Données : API n8n, signée par Telegram. */
(function () {
  'use strict';
  var API = 'https://n8nstrauto.duckdns.org/webhook/pilotage-api';
  var T0 = (window.performance && performance.now) ? performance.now() : 0;
  var tg = window.Telegram && window.Telegram.WebApp;
  var initData = (tg && tg.initData) || hashData();
  var E = null;               // état reçu du serveur
  var pile = [];              // historique de navigation
  var vue = { v: 'accueil' }; // vue courante
  var filtre = 'actives', recherche = '', agendaJour = 'auj', vueAmi = lireLocal('vueAmi') === '1';
  var app = document.getElementById('app');
  var JFR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var ACTIFS = ['Nouvelle', 'Annoncée', 'Attribuée'];

  function hashData() { try { var h = new URLSearchParams(location.hash.slice(1)); return h.get('tgWebAppData') || ''; } catch (e) { return ''; } }
  function lireLocal(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function ecrireLocal(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s) { return app.querySelector(s); }
  function vibre(k) { try { tg && tg.HapticFeedback && (k === 'ok' ? tg.HapticFeedback.notificationOccurred('success') : k === 'ko' ? tg.HapticFeedback.notificationOccurred('error') : tg.HapticFeedback.impactOccurred('light')); } catch (e) {} }
  function toast(msg, ko) { var t = document.getElementById('toast'); t.textContent = msg; t.className = ko ? 'ko' : ''; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(function () { t.hidden = true; }, ko ? 4500 : 2600); vibre(ko ? 'ko' : 'ok'); }
  function ouvrir(url) { if (!url) return; if (tg && tg.openLink && /^https?:/.test(url)) tg.openLink(url); else window.open(url, '_blank'); }
  function copier(txt) { function repli() { var a = document.createElement('textarea'); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (e) {} a.remove(); } if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Texte copié'); }, function () { repli(); toast('Texte copié'); }); else { repli(); toast('Texte copié'); } }
  function wa(tel, texte) { return 'https://wa.me/' + (tel || '') + '?text=' + encodeURIComponent(texte || ''); }

  // ---------- Dates ----------
  function jourDe(s) { var m = String(s || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!m) return null; return Math.round(Date.UTC(+m[3], +m[2] - 1, +m[1]) / 86400000); }
  function dateDe(n) { var d = new Date(n * 86400000); return ('0' + d.getUTCDate()).slice(-2) + '/' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '/' + d.getUTCFullYear(); }
  function wd(n) { return new Date(n * 86400000).getUTCDay(); }
  function auj() { return jourDe(E.aujourdhui); }
  function quandCourt(d) { var n = jourDe(d['Date souhaitée']); if (n === null) return d['Date souhaitée']; var e = n - auj(); var base = JFR[wd(n)].slice(0, 3) + '. ' + dateDe(n).slice(0, 5); return e === 0 ? "Aujourd'hui" : e === 1 ? 'Demain' : e === -1 ? 'Hier' : base; }
  function controleDate(n, creneau) {
    if (n === null) return 'date illisible';
    var a = auj(); if (n < a || n > a + 180) return 'la date doit être entre aujourd’hui et dans 6 mois';
    var raison = function (k) { return wd(k) === 6 ? 'Chabbat' : (E.fermes[dateDe(k)] || null); };
    var r0 = raison(n), r1 = raison(n + 1);
    if (r0 && r1) return r0 + ' : aucune activité ce jour-là';
    if (r0 && creneau !== 'Soir') return r0 + ' : seulement le soir après 18 h';
    if (!r0 && r1 && ['Matin', 'Après-midi'].indexOf(creneau) < 0) return 'veille de ' + r1 + ' : matin ou après-midi seulement (fin avant 17 h)';
    return null;
  }

  // ---------- Données ----------
  function client(id) { for (var i = 0; i < E.clients.length; i++) if (E.clients[i].id === id) return E.clients[i]; return {}; }
  function cleaner(id) { for (var i = 0; i < E.cleaners.length; i++) if (E.cleaners[i].id === id) return E.cleaners[i]; return null; }
  function demande(ref) { for (var i = 0; i < E.demandes.length; i++) if (E.demandes[i].Ref === String(ref)) return E.demandes[i]; return null; }
  function zoneDe(q) { for (var i = 0; i < E.quartiers.length; i++) if (E.quartiers[i].q === q) return E.quartiers[i].zone; return ''; }
  function journalDe(ref) { return E.journal.filter(function (j) { return j[2] === String(ref); }); }
  function sansCleaner(d) { return d.Statut === 'Nouvelle' || d.Statut === 'Annoncée'; }
  function urgence(d) { var n = jourDe(d['Date souhaitée']); var a = auj(); if (ACTIFS.indexOf(d.Statut) < 0) return 9; if (n === null) return 8; if (sansCleaner(d) && n < a) return 7; if (n === a) return sansCleaner(d) ? 0 : 2; if (n === a + 1) return sansCleaner(d) ? 1 : 3; return sansCleaner(d) ? 4 : 5; }
  function normTel(t) { var d = String(t || '').replace(/\D/g, ''); if (d.indexOf('00') === 0) d = d.slice(2); if (d.charAt(0) === '0') d = '972' + d.slice(1); return d.length >= 8 ? d : ''; }

  // ---------- API ----------
  function api(action, args) {
    var t = performance.now();
    var corps = new URLSearchParams(); corps.set('p', JSON.stringify({ initData: initData, action: action, args: args || {} }));
    return fetch(API, { method: 'POST', body: corps }).then(function (r) { return r.json(); }).then(function (j) {
      j._ms = Math.round(performance.now() - t);
      if (j.etat) poser(j.etat); else if (action === 'etat' && j.ok) poser(j);
      if (j.conflit) { toast(j.erreur, true); afficher(); }
      return j;
    });
  }
  function poser(e) { E = e; try { ecrireLocal('etat', JSON.stringify(e)); } catch (x) {} }
  function agir(action, args, apres) {
    vibre();
    return api(action, args).then(function (r) {
      if (r.ok) { toast(r.message || 'Fait'); if (apres) apres(r); else afficher(); } else if (!r.conflit) toast(r.erreur || 'Erreur', true);
      return r;
    }, function () { toast('Pas de connexion. Réessayez.', true); });
  }

  // ---------- Navigation ----------
  function aller(v, garde) { if (!garde) pile.push(vue); vue = v; window.scrollTo(0, 0); afficher(); }
  function retour() { vue = pile.pop() || { v: 'accueil' }; afficher(); }
  document.getElementById('retour').onclick = retour;
  document.getElementById('nouvelle').onclick = function () { aller({ v: 'nouvelle' }); };
  Array.prototype.forEach.call(document.querySelectorAll('#onglets button'), function (b) { b.onclick = function () { pile = []; aller({ v: b.getAttribute('data-v') }, true); }; });
  if (tg && tg.BackButton) tg.BackButton.onClick(retour);

  function cadre(titre) {
    document.getElementById('titre').textContent = titre;
    var racine = ['accueil', 'agenda', 'cleaners', 'clients', 'plus'].indexOf(vue.v) >= 0 && !pile.length;
    document.getElementById('retour').hidden = racine;
    if (tg && tg.BackButton) { if (racine) tg.BackButton.hide(); else tg.BackButton.show(); }
    Array.prototype.forEach.call(document.querySelectorAll('#onglets button'), function (b) { b.className = b.getAttribute('data-v') === vue.v ? 'actif' : ''; });
    document.getElementById('vue-ami').hidden = !(estAdmin(true) && vueAmi);
  }
  function estAdmin(brut) { var a = E && E.moi && E.moi.role === 'admin'; return brut ? a : (a && !vueAmi); }

  function afficher() {
    if (!E) return;
    var f = VUES[vue.v] || VUES.accueil; f();
    lier();
  }
  // Délégation des clics : data-a="action" data-x="valeur"
  function lier() { Array.prototype.forEach.call(app.querySelectorAll('[data-a]'), function (el) { el.onclick = function (ev) { ev.preventDefault(); var fn = ACTIONS[el.getAttribute('data-a')]; if (fn) fn(el.getAttribute('data-x'), el); }; }); }

  // ---------- Morceaux d'affichage ----------
  function carteHtml(d) {
    var c = client(d['ID client']), k = cleaner(d['Cleaner attribué']), n = jourDe(d['Date souhaitée']);
    var passe = n !== null && n < auj() && sansCleaner(d);
    var etat = d.Statut + (sansCleaner(d) ? ' · sans cleaner' : (k ? ' · ' + k.nom.split(' ')[0] : ''));
    return '<button class="carte s-' + esc(d.Statut) + '" data-a="fiche" data-x="' + esc(d.Ref) + '">' +
      '<div class="l1"><span>' + esc(quandCourt(d)) + ' · ' + esc((d['Créneau'] || '').toLowerCase()) + '</span><span class="note">Ref ' + esc(d.Ref) + '</span></div>' +
      '<div class="l2"><span dir="auto">' + esc(d.Quartier) + '</span> · ' + esc(d.Heures) + ' h · <span dir="auto">' + esc(c.nom || d['ID client']) + '</span></div>' +
      '<div class="etat c-' + esc(d.Statut) + (passe ? ' urgent' : '') + '">' + (passe ? '⚠ date passée · ' : '') + esc(etat) + '</div></button>';
  }
  function lignes(paires) { return paires.filter(function (p) { return p[1]; }).map(function (p) { return '<div class="ligne"><span class="k">' + p[0] + '</span><span class="v" dir="auto">' + p[1] + '</span></div>'; }).join(''); }
  function compteurs() {
    var a = auj(), D = E.demandes;
    var actives = D.filter(function (d) { return ACTIFS.indexOf(d.Statut) >= 0; });
    var c = {
      aujourdhui: actives.filter(function (d) { return jourDe(d['Date souhaitée']) === a; }).length,
      annoncer: actives.filter(function (d) { return d.Statut === 'Nouvelle' && jourDe(d['Date souhaitée']) >= a; }).length,
      sans: actives.filter(function (d) { return sansCleaner(d) && jourDe(d['Date souhaitée']) >= a && jourDe(d['Date souhaitée']) <= a + 1; }).length,
      venir: actives.filter(function (d) { return jourDe(d['Date souhaitée']) > a; }).length
    };
    function b(k, lib, alerte) { return '<button class="compteur' + (alerte && c[k] ? ' alerte' : '') + (filtre === k ? ' choisi' : '') + '" data-a="filtre" data-x="' + k + '"><b>' + c[k] + '</b><small>' + lib + '</small></button>'; }
    return '<div class="compteurs">' + b('aujourdhui', "Aujourd'hui") + b('annoncer', 'À annoncer', true) + b('sans', 'Sans cleaner (auj./demain)', true) + b('venir', 'À venir') + '</div>';
  }
  function filtrer(d) {
    var a = auj(), n = jourDe(d['Date souhaitée']);
    switch (filtre) {
      case 'aujourdhui': return ACTIFS.indexOf(d.Statut) >= 0 && n === a;
      case 'annoncer': return d.Statut === 'Nouvelle' && n >= a;
      case 'sans': return sansCleaner(d) && n >= a && n <= a + 1;
      case 'sansTous': return sansCleaner(d) && n >= a;
      case 'venir': return ACTIFS.indexOf(d.Statut) >= 0 && n > a;
      case 'attribuees': return d.Statut === 'Attribuée';
      case 'retard': return sansCleaner(d) && n !== null && n < a;
      case 'terminees': return d.Statut === 'Clôturée' || d.Statut === 'Annulée';
      case 'toutes': return true;
      default: return ACTIFS.indexOf(d.Statut) >= 0 && (n === null || n >= a - 1 || d.Statut !== 'Attribuée');
    }
  }
  function cherche(d) {
    if (!recherche) return true; var q = recherche.toLowerCase(), c = client(d['ID client']);
    return [d.Ref, d.Quartier, d['Adresse complète'], c.nom, c.tel, d['ID client']].join(' ').toLowerCase().indexOf(q) >= 0 || (normTel(recherche) && (c.tel || '').indexOf(normTel(recherche)) >= 0);
  }

  // ---------- Vues ----------
  var VUES = {
    accueil: function () {
      cadre('Demandes');
      var liste = E.demandes.filter(function (d) { return filtrer(d) && cherche(d); }).sort(function (x, y) { return urgence(x) - urgence(y) || (jourDe(x['Date souhaitée']) || 0) - (jourDe(y['Date souhaitée']) || 0); });
      var puces = [['actives', 'En cours'], ['sansTous', 'Sans cleaner'], ['attribuees', 'Attribuées'], ['retard', 'Date passée'], ['terminees', 'Terminées'], ['toutes', 'Toutes']];
      app.innerHTML = (E.silence ? '<p class="note">🔕 ' + (E.silence === 'nuit' ? 'Mode nuit' : 'Chabbat / fête') + ' : le bot ne sonne pas.</p>' : '') + compteurs() +
        '<input class="chercher" id="q" type="search" placeholder="Nom, téléphone, Ref, quartier" value="' + esc(recherche) + '">' +
        '<div class="puces">' + puces.map(function (p) { return '<button class="puce' + (filtre === p[0] ? ' choisi' : '') + '" data-a="filtre" data-x="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        (liste.length ? liste.slice(0, 120).map(carteHtml).join('') : '<p class="vide">Aucune demande ici.</p>');
      var q = $('#q'); q.oninput = function () { recherche = q.value; var p = q.selectionStart; VUES.accueil(); lier(); var q2 = $('#q'); q2.focus(); try { q2.setSelectionRange(p, p); } catch (e) {} };
    },
    fiche: function () {
      var d = demande(vue.r); if (!d) { cadre('Demande'); app.innerHTML = '<p class="vide">Demande introuvable.</p>'; return; }
      cadre('Ref ' + d.Ref);
      var c = client(d['ID client']), k = cleaner(d['Cleaner attribué']), j = journalDe(d.Ref);
      var st = d.Statut, h = '';
      h += '<div class="bloc"><div class="etat c-' + esc(st) + '" style="font-weight:700;font-size:16px">' + esc(st) + '</div>' + lignes([
        ['Quand', esc(quandCourt(d) + ' (' + d['Date souhaitée'] + ') · ' + (d['Créneau'] || '').toLowerCase() + ' · ' + (d['Flexibilité'] || '').toLowerCase())],
        ['Durée', esc(d.Heures + ' h · ' + d['Intervenant souhaité'] + ' · ' + d['Fréquence'])],
        ['Client', esc(c.nom || d['ID client']) + (c.tel ? ' · <a href="tel:+' + esc(c.tel) + '">+' + esc(c.tel) + '</a>' : '')],
        ['Quartier', esc(d.Quartier) + (zoneDe(d.Quartier) ? ' (' + esc(zoneDe(d.Quartier)) + ')' : '')],
        ['Adresse', esc(d['Adresse complète'])],
        ['Accès', esc(d["Complément d'adresse (accès)"])],
        ['Cleaner', k ? esc(k.nom) + (k.tel ? ' · <a href="tel:+' + esc(k.tel) + '">appeler</a>' : '') : '—'],
        ['Tarifs', esc((d['Tarif client (₪/h)'] || E.tarifs.client) + ' ₪/h client · ' + (d['Payé cleaner (₪/h)'] || E.tarifs.cleaner) + ' ₪/h cleaner')],
        ['Notes', esc(d.Notes)]
      ]) + '</div>';
      h += '<div class="actions">';
      if (st === 'Nouvelle') h += '<button class="btn principal large" data-a="partager" data-x="' + d.Ref + '">📣 Partager l’annonce</button><button class="btn" data-a="statut" data-x="Annoncée">✅ Publiée</button><button class="btn" data-a="attribuer" data-x="' + d.Ref + '">👤 Attribuer</button>';
      else if (st === 'Annoncée') h += '<button class="btn principal large" data-a="attribuer" data-x="' + d.Ref + '">👤 Attribuer un cleaner</button><button class="btn" data-a="partager" data-x="' + d.Ref + '">📣 Re-partager</button><button class="btn" data-a="statut" data-x="Nouvelle">↩ Pas publiée</button>';
      else if (st === 'Attribuée') h += '<button class="btn principal large" data-a="partager" data-x="' + d.Ref + '">📤 Fiche mission et confirmation</button><button class="btn" data-a="statut" data-x="Clôturée">⚪ Clôturer</button><button class="btn" data-a="attribuer" data-x="' + d.Ref + '">👤 Changer de cleaner</button><button class="btn large" data-a="desister">🙅 Le cleaner se désiste</button>';
      else h += '<button class="btn principal large" data-a="rereserver" data-x="' + d.Ref + '">🔁 Re-réserver</button>';
      h += '<button class="btn" data-a="maps">📍 Maps</button>';
      if (ACTIFS.indexOf(st) >= 0) h += '<button class="btn" data-a="decaler" data-x="' + d.Ref + '">📅 Décaler</button><button class="btn" data-a="rereserver" data-x="' + d.Ref + '">🔁 Re-réserver</button><button class="btn danger" data-a="annuler">🔴 Annuler</button>';
      if (j.length) h += '<button class="btn large" data-a="erreur">↩ Annuler la dernière action (« ' + esc(j[j.length - 1][3]) + ' »)</button>';
      h += '<button class="btn large" data-a="carte">💬 Renvoyer la carte dans le bot</button></div>';
      h += '<div class="bloc" style="margin-top:10px"><h2>Historique</h2>' + (j.length ? j.slice().reverse().map(function (x) { return '<div class="histo"><b>' + esc(x[3]) + '</b> · ' + esc(x[0].slice(0, 16)) + ' · ' + esc(x[1]) + '<br><span class="note">' + esc(x[4]) + ' : ' + esc(x[5] || '—') + ' → ' + esc(x[6] || '—') + '</span></div>'; }).join('') : '<p class="note">Reçue le ' + esc(d['Reçue le']) + '. Aucune modification depuis.</p>') + '</div>';
      app.innerHTML = h;
    },
    attribuer: function () {
      var d = demande(vue.r); if (!d) return VUES.fiche();
      cadre('Attribuer · Ref ' + d.Ref);
      var n = jourDe(d['Date souhaitée']), jour = n !== null ? JFR[wd(n)] : '', zone = zoneDe(d.Quartier), cl = client(d['ID client']);
      var liste = E.cleaners.map(function (k) {
        var r = [], s = 0, zs = (k.zones || '').toLowerCase(), dispo = (k.dispo || '').toLowerCase(), cr = (k.creneaux || '').toLowerCase();
        if (zone && zs.indexOf(zone.toLowerCase()) >= 0 || zs.indexOf((d.Quartier || '').toLowerCase()) >= 0) { s += 3; r.push(['ok', 'zone']); } else if (zs) r.push(['ko', 'autre zone']);
        if (jour && (dispo.indexOf(jour) >= 0 || dispo.indexOf(jour.slice(0, 3)) >= 0 || /tous|flex|7\/7/.test(dispo))) { s += 2; r.push(['ok', jour]); } else if (dispo) r.push(['ko', 'pas le ' + jour]);
        var c = (d['Créneau'] || '').toLowerCase(); if (c && (cr.indexOf(c) >= 0 || /flex|journ/.test(cr))) { s += 1; r.push(['ok', c]); }
        var voulu = d['Intervenant souhaité'] || ''; if (/^Femme$|^Homme$/.test(voulu)) { if (k.genre === voulu) { s += 2; r.push(['ok', voulu.toLowerCase()]); } else if (k.genre) { s -= 2; r.push(['ko', 'souhait : ' + voulu.toLowerCase()]); } }
        var lg = (k.langues || '').toLowerCase(); if (/angl/i.test(cl.langue || '') && /angl|engl/.test(lg)) { s += 1; r.push(['ok', 'anglais']); } if (/fran/i.test(cl.langue || '') && /fran/.test(lg)) { s += 1; r.push(['ok', 'français']); }
        var nb = E.demandes.filter(function (x) { return x['Cleaner attribué'] === k.id && (x.Statut === 'Attribuée' || x.Statut === 'Clôturée'); }).length;
        var occupe = E.demandes.some(function (x) { return x['Cleaner attribué'] === k.id && x.Ref !== d.Ref && x.Statut === 'Attribuée' && x['Date souhaitée'] === d['Date souhaitée'] && x['Créneau'] === d['Créneau']; });
        if (occupe) { s -= 3; r.push(['ko', 'déjà pris sur ce créneau']); }
        return { k: k, s: s, r: r, nb: nb };
      }).sort(function (a, b) { return b.s - a.s || b.nb - a.nb; });
      function ligne(x) { var k = x.k, actuel = d['Cleaner attribué'] === k.id; return '<div class="bloc"><div class="l1" style="display:flex;justify-content:space-between"><b dir="auto">' + esc(k.nom) + '</b><span class="note">' + x.nb + ' mission(s)</span></div><div>' + x.r.map(function (y) { return '<span class="raison ' + y[0] + '">' + esc(y[1]) + '</span>'; }).join('') + '</div><div class="actions" style="margin-top:8px">' + (actuel ? '<span class="btn">✔ Attribuée</span>' : '<button class="btn principal" data-a="choisir" data-x="' + esc(k.id) + '">Attribuer</button>') + (k.tel ? '<button class="btn" data-a="ouvrir" data-x="' + esc(wa(k.tel, '')) + '">💬 WhatsApp</button>' : '') + '</div></div>'; }
      var act = liste.filter(function (x) { return x.k.actif; }), ina = liste.filter(function (x) { return !x.k.actif; });
      app.innerHTML = '<p class="note">' + esc(d.Quartier) + (zone ? ' (' + esc(zone) + ')' : '') + ' · ' + esc(quandCourt(d)) + ' ' + esc((d['Créneau'] || '').toLowerCase()) + ' · ' + esc(d['Intervenant souhaité']) + '. Triés par pertinence : personne n’est écarté.</p>' +
        (act.length ? act.map(ligne).join('') : '<p class="vide">Aucun cleaner actif.</p>') + (ina.length ? '<div class="groupe">Inactifs (' + ina.length + ')</div>' + ina.map(ligne).join('') : '');
    },
    partager: function () {
      var d = demande(vue.r); if (!d) return VUES.fiche();
      cadre('Partager · Ref ' + d.Ref);
      var m = d._m, k = cleaner(d['Cleaner attribué']), c = client(d['ID client']);
      if (!m) { app.innerHTML = '<p class="vide">Textes indisponibles pour cette demande (trop ancienne ou annulée).</p>'; return; }
      function bloc(titre, tel, texte, note) { return '<div class="bloc"><h2>' + titre + '</h2>' + (note ? '<p class="note">' + note + '</p>' : '') + '<div class="texte-msg" dir="auto">' + esc(texte) + '</div><div class="actions"><button class="btn principal" data-a="ouvrir" data-x="' + esc(wa(tel, texte)) + '">Ouvrir WhatsApp</button><button class="btn" data-a="copier" data-x="' + esc(texte) + '">Copier</button></div></div>'; }
      var h = '';
      if (d.Statut === 'Nouvelle' || d.Statut === 'Annoncée') h += bloc('📣 Annonce (FR + EN) pour votre chaîne', '', m.annonce, 'WhatsApp s’ouvre : choisissez votre chaîne ou un groupe. Si la chaîne n’apparaît pas, utilisez « Copier » puis collez dans la chaîne. Jamais d’adresse dans l’annonce.') + (d.Statut === 'Nouvelle' ? '<button class="btn large" data-a="statut" data-x="Annoncée" style="margin-bottom:10px">✅ C’est publié</button>' : '');
      if (k) h += bloc('📤 Fiche mission à ' + esc(k.nom.split(' ')[0]), m.fiche.tel, m.fiche.texte, 'Contient l’adresse complète et le contact du client : à envoyer seulement au cleaner choisi.');
      h += bloc('💬 Confirmation au client' + (c.nom ? ' (' + esc(c.nom) + ')' : ''), m.confirmation.tel, m.confirmation.texte, k ? '' : 'Aucun cleaner attribué : le prénom du cleaner manque encore.');
      app.innerHTML = h;
    },
    decaler: function () {
      var d = demande(vue.r); if (!d) return VUES.fiche();
      cadre('Décaler · Ref ' + d.Ref);
      var n = jourDe(d['Date souhaitée']); var iso = n !== null ? new Date(n * 86400000).toISOString().slice(0, 10) : '';
      vue.cr = vue.cr || d['Créneau'];
      app.innerHTML = '<div class="bloc"><p class="note">Actuellement : ' + esc(d['Date souhaitée']) + ', ' + esc((d['Créneau'] || '').toLowerCase()) + '.</p><label class="champ">Nouvelle date</label><input class="champ" id="date" type="date" value="' + esc(vue.date || iso) + '">' +
        '<label class="champ">Créneau</label><div class="choix">' + E.listes.creneaux.map(function (c) { return '<button class="' + (vue.cr === c ? 'choisi' : '') + '" data-a="cr" data-x="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div><div id="err" class="erreur"></div>' +
        '<button class="btn principal large" style="margin-top:12px;width:100%" data-a="valider_decalage">Décaler</button></div>';
      var di = $('#date'); di.onchange = function () { vue.date = di.value; verif(); }; verif();
      function verif() { var v = di.value.split('-'); var k = v.length === 3 ? Math.round(Date.UTC(+v[0], +v[1] - 1, +v[2]) / 86400000) : null; var e = controleDate(k, vue.cr); $('#err').textContent = e ? '⚠ ' + e : ''; }
    },
    nouvelle: function () {
      cadre(vue.ref_origine ? 'Re-réserver · Ref ' + vue.ref_origine : 'Nouvelle demande');
      var f = vue.f || (vue.f = { heures: 3, creneau: 'Matin', intervenant: 'Homme ou femme', frequence: 'Ponctuel', flexibilite: 'Horaires flexibles' });
      var cl = f.telephone ? E.clients.filter(function (c) { return c.tel && c.tel === normTel(f.telephone); })[0] : null;
      function choix(nom, liste) { return '<div class="choix">' + liste.map(function (v) { return '<button class="' + (f[nom] === v ? 'choisi' : '') + '" data-a="champ" data-x="' + esc(nom + '|' + v) + '">' + esc(v) + '</button>'; }).join('') + '</div>'; }
      var h = '<div class="bloc"><label class="champ">Téléphone du client</label><input class="champ" id="tel" type="tel" inputmode="tel" placeholder="050 123 4567" value="' + esc(f.telephone || '') + '">' +
        (cl ? '<p class="note">✔ Client connu : <b dir="auto">' + esc(cl.nom) + '</b> (' + esc(cl.id) + '). Infos pré-remplies, modifiables.</p>' : (f.telephone && normTel(f.telephone) ? '<p class="note">Nouveau client.</p><label class="champ">Nom</label><input class="champ" id="nom" dir="auto" value="' + esc(f.nom || '') + '">' : '')) +
        '<label class="champ">Quartier</label><input class="champ" id="quartier" dir="auto" placeholder="Tapez : bay, tal…" value="' + esc(f.quartier || '') + '" autocomplete="off"><div id="qliste"></div>' +
        '<label class="champ">Adresse</label><input class="champ" id="adresse" dir="auto" value="' + esc(f.adresse || '') + '">' +
        '<label class="champ">Bâtiment, étage, accès (facultatif)</label><input class="champ" id="complement" dir="auto" value="' + esc(f.complement || '') + '">' +
        '<label class="champ">Date</label><input class="champ" id="date" type="date" value="' + esc(f.date || '') + '">' +
        '<label class="champ">Créneau</label>' + choix('creneau', E.listes.creneaux) +
        '<label class="champ">Durée</label><div class="stepper"><button data-a="heures" data-x="-1">−</button><b>' + f.heures + ' h</b><button data-a="heures" data-x="1">＋</button></div>' +
        '<label class="champ">Intervenant</label>' + choix('intervenant', E.listes.intervenants) +
        '<label class="champ">Fréquence</label>' + choix('frequence', E.listes.frequences) +
        '<label class="champ">Horaires</label>' + choix('flexibilite', E.listes.flexibilites) +
        '<label class="champ">Notes (facultatif)</label><textarea class="champ" id="notes" rows="2" dir="auto">' + esc(f.notes || '') + '</textarea>' +
        '<div id="err" class="erreur"></div><button class="btn principal" style="margin-top:12px;width:100%" data-a="creer">Créer la demande</button></div>';
      app.innerHTML = h;
      ['tel', 'nom', 'quartier', 'adresse', 'complement', 'date', 'notes'].forEach(function (id) { var el = $('#' + id); if (!el) return; el.oninput = function () { f[id === 'tel' ? 'telephone' : id] = el.value; if (id === 'quartier') listeQ(); if (id === 'date' || id === 'quartier') verif(); }; });
      var t = $('#tel'); t.onchange = function () { f.telephone = t.value; var c = E.clients.filter(function (x) { return x.tel && x.tel === normTel(t.value); })[0]; if (c) preremplir(f, c); VUES.nouvelle(); lier(); };
      function listeQ() { var q = (f.quartier || '').toLowerCase(), box = $('#qliste'); var ok = E.quartiers.some(function (x) { return x.q === f.quartier; }); if (!q || ok) { box.innerHTML = ''; return; } var l = E.quartiers.filter(function (x) { return x.q.toLowerCase().indexOf(q) >= 0; }).slice(0, 8); box.innerHTML = l.length ? '<div class="liste-q">' + l.map(function (x) { return '<button data-a="q" data-x="' + esc(x.q) + '">' + esc(x.q) + ' <span class="note">' + esc(x.zone) + '</span></button>'; }).join('') + '</div>' : '<p class="erreur">Quartier inconnu : choisissez dans la liste.</p>'; lier(); }
      function verif() { var v = String(f.date || '').split('-'); var k = v.length === 3 ? Math.round(Date.UTC(+v[0], +v[1] - 1, +v[2]) / 86400000) : null; var e = f.date ? controleDate(k, f.creneau) : null; $('#err').textContent = e ? '⚠ ' + e : ''; }
      listeQ(); verif();
    },
    clients: function () {
      cadre('Clients');
      var l = E.clients.filter(function (c) { return !recherche || (c.nom + ' ' + c.tel + ' ' + c.quartier + ' ' + c.id).toLowerCase().indexOf(recherche.toLowerCase()) >= 0; });
      app.innerHTML = '<input class="chercher" id="q" type="search" placeholder="Nom, téléphone, quartier" value="' + esc(recherche) + '">' + l.map(function (c) { var n = E.demandes.filter(function (d) { return d['ID client'] === c.id; }).length; return '<button class="carte" data-a="client" data-x="' + esc(c.id) + '"><div class="l1"><span dir="auto">' + esc(c.nom) + '</span><span class="note">' + n + ' demande(s)</span></div><div class="l2" dir="auto">' + esc(c.quartier) + ' · ' + esc(c.tel ? '+' + c.tel : '') + '</div></button>'; }).join('');
      var q = $('#q'); q.oninput = function () { recherche = q.value; var p = q.selectionStart; VUES.clients(); lier(); var q2 = $('#q'); q2.focus(); try { q2.setSelectionRange(p, p); } catch (e) {} };
    },
    client: function () {
      var c = client(vue.id); cadre(c.nom || 'Client');
      var ds = E.demandes.filter(function (d) { return d['ID client'] === c.id; }).sort(function (a, b) { return (jourDe(b['Date souhaitée']) || 0) - (jourDe(a['Date souhaitée']) || 0); });
      var der = ds[0];
      app.innerHTML = '<div class="bloc">' + lignes([['Téléphone', c.tel ? '<a href="tel:+' + esc(c.tel) + '">+' + esc(c.tel) + '</a>' : ''], ['Quartier', esc(c.quartier)], ['Adresse', esc(c.adresse)], ['Langue', esc(c.langue)], ['Depuis', esc(c.cree)], ['Habitude', der ? esc(der['Fréquence'] + ' · ' + der.Heures + ' h · ' + (der['Créneau'] || '').toLowerCase()) : ''], ['Notes', esc(c.notes)]]) + '</div>' +
        '<div class="actions">' + (der ? '<button class="btn principal large" data-a="rereserver" data-x="' + esc(der.Ref) + '">🔁 Re-réserver comme la dernière fois</button>' : '') + '<button class="btn" data-a="nouvelle_client" data-x="' + esc(c.id) + '">＋ Nouvelle demande</button>' + (c.tel ? '<button class="btn" data-a="ouvrir" data-x="' + esc(wa(c.tel, '')) + '">💬 WhatsApp</button>' : '') + '</div>' +
        '<div class="groupe">Demandes (' + ds.length + ')</div>' + ds.map(carteHtml).join('');
    },
    cleaners: function () {
      cadre('Cleaners');
      var l = E.cleaners.slice().sort(function (a, b) { return (b.actif - a.actif) || a.nom.localeCompare(b.nom); });
      app.innerHTML = l.map(function (k) { var nb = E.demandes.filter(function (x) { return x['Cleaner attribué'] === k.id && (x.Statut === 'Attribuée' || x.Statut === 'Clôturée'); }).length; return '<button class="carte ' + (k.actif ? 's-Attribuée' : 's-Clôturée') + '" data-a="cleaner" data-x="' + esc(k.id) + '"><div class="l1"><span dir="auto">' + esc(k.nom) + '</span><span class="note">' + (k.actif ? 'actif' : 'inactif') + '</span></div><div class="l2">' + esc(k.zones || 'zones ?') + ' · ' + nb + ' mission(s)</div></button>'; }).join('') || '<p class="vide">Aucun cleaner.</p>';
    },
    cleaner: function () {
      var k = cleaner(vue.id); if (!k) return VUES.cleaners(); cadre(k.nom);
      var ms = E.demandes.filter(function (x) { return x['Cleaner attribué'] === k.id && (x.Statut === 'Attribuée' || x.Statut === 'Clôturée'); }).sort(function (a, b) { return (jourDe(b['Date souhaitée']) || 0) - (jourDe(a['Date souhaitée']) || 0); });
      app.innerHTML = '<div class="bloc">' + lignes([['État', k.actif ? 'Actif' : 'Inactif'], ['Téléphone', k.tel ? '<a href="tel:+' + esc(k.tel) + '">+' + esc(k.tel) + '</a>' : ''], ['Zones', esc(k.zones)], ['Jours', esc(k.dispo)], ['Créneaux', esc(k.creneaux)], ['Langues', esc(k.langues)], ['Expérience', esc(k.experience)], ['Missions', String(ms.length)], ['Dernière', ms[0] ? esc(ms[0]['Date souhaitée'] + ' (Ref ' + ms[0].Ref + ')') : ''], ['Inscrit le', esc(k.inscrit)], ['Notes', esc(k.notes)]]) + '</div>' +
        '<div class="actions">' + (k.tel ? '<a class="btn" href="tel:+' + esc(k.tel) + '">📞 Appeler</a><button class="btn" data-a="ouvrir" data-x="' + esc(wa(k.tel, '')) + '">💬 WhatsApp</button>' : '') + '<button class="btn large' + (k.actif ? ' danger' : ' principal') + '" data-a="actif" data-x="' + (k.actif ? '0' : '1') + '">' + (k.actif ? 'Désactiver' : 'Activer') + ' ce cleaner</button></div>' +
        '<div class="groupe">Missions</div>' + ms.map(carteHtml).join('');
    },
    agenda: function () {
      cadre('Agenda');
      var a = auj(), de = agendaJour === 'auj' ? a : agendaJour === 'dem' ? a + 1 : a, a2 = agendaJour === 'sem' ? a + 6 : de;
      var l = E.demandes.filter(function (d) { var n = jourDe(d['Date souhaitée']); return ACTIFS.indexOf(d.Statut) >= 0 && n !== null && n >= de && n <= a2; });
      var groupes = {}; l.forEach(function (d) { var k = cleaner(d['Cleaner attribué']); var g = k ? k.nom : '⚠ Sans cleaner'; (groupes[g] = groupes[g] || []).push(d); });
      var noms = Object.keys(groupes).sort(function (x, y) { return (x.charAt(0) === '⚠' ? -1 : 0) - (y.charAt(0) === '⚠' ? -1 : 0) || x.localeCompare(y); });
      app.innerHTML = '<div class="puces">' + [['auj', "Aujourd'hui"], ['dem', 'Demain'], ['sem', '7 jours']].map(function (p) { return '<button class="puce' + (agendaJour === p[0] ? ' choisi' : '') + '" data-a="agenda" data-x="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
        (noms.length ? noms.map(function (g) { return '<div class="groupe" dir="auto">' + esc(g) + ' (' + groupes[g].length + ')</div>' + groupes[g].sort(function (x, y) { return jourDe(x['Date souhaitée']) - jourDe(y['Date souhaitée']); }).map(carteHtml).join(''); }).join('') : '<p class="vide">Rien de prévu.</p>');
    },
    plus: function () {
      cadre('Plus');
      app.innerHTML = '<div class="actions"><button class="btn" data-a="aller" data-x="chiffres">📈 Chiffres</button><button class="btn" data-a="aller" data-x="aide">❓ Les 5 gestes</button><button class="btn large" data-a="aller" data-x="reglages">⚙ Réglages</button></div>';
    },
    chiffres: function () {
      cadre('Chiffres (estimés)');
      var a = auj(), dim = a - wd(a), m = E.aujourdhui.slice(3);
      function calc(f) { var r = { n: 0, h: 0, ca: 0, cout: 0 }; E.demandes.forEach(function (d) { if (!(d.Statut === 'Attribuée' || d.Statut === 'Clôturée') || !f(d)) return; var h = Number(d.Heures) || 0; r.n++; r.h += h; r.ca += h * (Number(d['Tarif client (₪/h)']) || E.tarifs.client); r.cout += h * (Number(d['Payé cleaner (₪/h)']) || E.tarifs.cleaner); }); return r; }
      var sem = calc(function (d) { var n = jourDe(d['Date souhaitée']); return n >= dim && n < dim + 7; }), mois = calc(function (d) { return String(d['Date souhaitée']).slice(3) === m; });
      var attente = E.demandes.filter(function (d) { return sansCleaner(d) && jourDe(d['Date souhaitée']) >= a; });
      function bloc(t, r) { return '<div class="bloc"><h2>' + t + '</h2><div class="chiffre"><span>Missions</span><b>' + r.n + '</b></div><div class="chiffre"><span>Heures</span><b>' + r.h + ' h</b></div><div class="chiffre"><span>Chiffre d’affaires</span><b>' + Math.round(r.ca) + ' ₪</b></div><div class="chiffre"><span>Payé aux cleaners</span><b>' + Math.round(r.cout) + ' ₪</b></div><div class="chiffre"><span>Marge</span><b>' + Math.round(r.ca - r.cout) + ' ₪</b></div></div>'; }
      app.innerHTML = '<p class="note">Estimations : missions attribuées ou clôturées × tarifs de la demande (sinon ' + E.tarifs.client + ' / ' + E.tarifs.cleaner + ' ₪/h). Les paiements réels ne sont pas encore suivis.</p>' + bloc('Cette semaine (dim. → sam.)', sem) + bloc('Ce mois-ci', mois) + '<div class="bloc"><h2>En attente de cleaner</h2><div class="chiffre"><span>Demandes à venir</span><b>' + attente.length + '</b></div></div>';
    },
    aide: function () {
      cadre('Les 5 gestes');
      var g = [['📋', 'Une demande arrive', 'Une carte s’affiche dans le bot et ici. Elle se met à jour toute seule : pas de nouveaux messages à chaque clic.'], ['📣', 'Partager l’annonce', 'WhatsApp s’ouvre avec l’annonce FR + EN prête. Choisissez votre chaîne, envoyez, puis appuyez sur « Publiée ».'], ['👤', 'Attribuer', 'Choisissez le cleaner parmi la liste triée (zone, jour, créneau). Personne n’est écarté.'], ['📤', 'Fiche mission et confirmation', 'Envoyez en un geste l’adresse, le lien Maps et le contact au cleaner, puis la confirmation au client.'], ['📌', 'Savoir où vous en êtes', 'Le point épinglé du bot et les compteurs ici. Le bot ne sonne que pour l’essentiel, jamais la nuit ni pendant Chabbat.']];
      app.innerHTML = '<div class="bloc">' + g.map(function (x) { return '<div class="geste"><span>' + x[0] + '</span><div><b>' + x[1] + '</b><br><span class="note">' + x[2] + '</span></div></div>'; }).join('') + '</div><p class="note">Une erreur ? Dans la fiche : « Annuler la dernière action ». Un client qui décale : « Décaler ». Un habitué : « Re-réserver ».</p>';
    },
    reglages: function () {
      cadre('Réglages');
      var p = E.moi.notifications;
      var h = '<div class="bloc"><h2>Sonneries du bot</h2><div class="choix"><button class="' + (p === 'Tout' ? 'choisi' : '') + '" data-a="prefs" data-x="Tout">🔔 Tout</button><button class="' + (p === 'Essentiel' ? 'choisi' : '') + '" data-a="prefs" data-x="Essentiel">🔕 Seulement l’essentiel</button></div><p class="note">Essentiel : nouvelle demande et alerte de 18 h (demain sans cleaner). Tout : aussi le point du matin. Rien ne sonne de 21 h à 8 h ni pendant Chabbat et les fêtes.</p></div>';
      if (estAdmin(true)) h += '<div class="bloc"><h2>Administration</h2><div class="actions"><button class="btn large" data-a="vueami">' + (vueAmi ? '👁 Revenir en vue admin' : '👁 Voir comme l’ami (vue gérant)') + '</button>' + (estAdmin() ? '<button class="btn" data-a="recharger">↻ Recharger</button>' : '') + '</div>' + (estAdmin() ? '<p class="note">Connecté : ' + esc(E.moi.nom) + ' (' + esc(E.moi.role) + ') · dernière réponse ' + (window.__ms || '?') + ' ms · ouverture ' + (window.__ouverture || '?') + ' ms</p>' : '') + '</div>';
      app.innerHTML = h;
    }
  };

  // ---------- Actions ----------
  function preremplir(f, c) { f.nom = c.nom; f.quartier = f.quartier || c.quartier; f.adresse = f.adresse || c.adresse; var der = E.demandes.filter(function (d) { return d['ID client'] === c.id; }).pop(); if (der && !f._pre) { f._pre = 1; f.heures = Number(der.Heures) || f.heures; f.creneau = der['Créneau'] || f.creneau; f.intervenant = der['Intervenant souhaité'] || f.intervenant; f.frequence = der['Fréquence'] || f.frequence; f.flexibilite = der['Flexibilité'] || f.flexibilite; f.complement = f.complement || der["Complément d'adresse (accès)"]; if (!f.quartier) f.quartier = der.Quartier; } }
  var ACTIONS = {
    filtre: function (x) { filtre = filtre === x && ['aujourdhui', 'annoncer', 'sans', 'venir'].indexOf(x) >= 0 ? 'actives' : x; VUES.accueil(); lier(); },
    fiche: function (x) { aller({ v: 'fiche', r: x }); },
    attribuer: function (x) { aller({ v: 'attribuer', r: x }); },
    partager: function (x) { aller({ v: 'partager', r: x }); },
    decaler: function (x) { aller({ v: 'decaler', r: x }); },
    rereserver: function (x) { var d = demande(x); if (!d) return; var c = client(d['ID client']); var f = { telephone: c.tel ? '+' + c.tel : '', nom: c.nom, quartier: d.Quartier, adresse: d['Adresse complète'], complement: d["Complément d'adresse (accès)"], heures: Number(d.Heures) || 3, creneau: d['Créneau'], intervenant: d['Intervenant souhaité'], frequence: d['Fréquence'], flexibilite: d['Flexibilité'], _pre: 1 }; aller({ v: 'nouvelle', f: f, ref_origine: d.Ref }); },
    nouvelle_client: function (x) { var c = client(x); var f = { telephone: c.tel ? '+' + c.tel : '', heures: 3, creneau: 'Matin', intervenant: 'Homme ou femme', frequence: 'Ponctuel', flexibilite: 'Horaires flexibles' }; preremplir(f, c); aller({ v: 'nouvelle', f: f }); },
    client: function (x) { aller({ v: 'client', id: x }); },
    cleaner: function (x) { aller({ v: 'cleaner', id: x }); },
    aller: function (x) { aller({ v: x }); },
    agenda: function (x) { agendaJour = x; VUES.agenda(); lier(); },
    ouvrir: function (x) { ouvrir(x); },
    copier: function (x) { copier(x); },
    maps: function () { var d = demande(vue.r); ouvrir(d['Lien Maps'] || (d['Position GPS'] ? 'https://www.google.com/maps/search/?api=1&query=' + d['Position GPS'] : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d['Adresse complète'] + ', Jerusalem'))); },
    statut: function (x) { var d = demande(vue.r); agir('statut', { ref: d.Ref, statut: x, v: d['Modifié le'] }); },
    choisir: function (x) { var d = demande(vue.r); agir('attribuer', { ref: d.Ref, cleaner: x, v: d['Modifié le'] }, function () { pile.push({ v: 'fiche', r: d.Ref }); vue = { v: 'partager', r: d.Ref }; afficher(); }); },
    desister: function () { var d = demande(vue.r); confirmer('Le cleaner se désiste : retirer ' + ((cleaner(d['Cleaner attribué']) || {}).nom || '') + ' de la Ref ' + d.Ref + ' ? La demande repasse « Annoncée ».', function () { agir('desattribuer', { ref: d.Ref, v: d['Modifié le'] }, function () { vue = { v: 'attribuer', r: d.Ref }; afficher(); }); }); },
    annuler: function () { var d = demande(vue.r); confirmer('Annuler la demande Ref ' + d.Ref + ' (' + d['Date souhaitée'] + ', ' + d.Quartier + ') ?', function () { agir('annuler', { ref: d.Ref, v: d['Modifié le'] }); }); },
    erreur: function () { var d = demande(vue.r); var j = journalDe(d.Ref); confirmer('Annuler « ' + j[j.length - 1][3] + ' » ?', function () { agir('erreur', { ref: d.Ref, v: d['Modifié le'] }); }); },
    carte: function () { var d = demande(vue.r); agir('carte', { ref: d.Ref }); },
    cr: function (x) { vue.cr = x; VUES.decaler(); lier(); },
    valider_decalage: function () { var d = demande(vue.r); var di = $('#date').value; if (!di) return toast('Choisissez une date', true); agir('decaler', { ref: d.Ref, date: di, creneau: vue.cr, v: d['Modifié le'] }, function () { retour(); }); },
    champ: function (x) { var i = x.indexOf('|'); vue.f[x.slice(0, i)] = x.slice(i + 1); VUES.nouvelle(); lier(); },
    heures: function (x) { vue.f.heures = Math.max(2, Math.min(8, (vue.f.heures || 3) + Number(x))); VUES.nouvelle(); lier(); },
    q: function (x) { vue.f.quartier = x; VUES.nouvelle(); lier(); },
    creer: function (x, el) {
      var f = vue.f; var args = { telephone: f.telephone, nom: f.nom, quartier: f.quartier, adresse: f.adresse, complement: f.complement, date: f.date, creneau: f.creneau, heures: f.heures, intervenant: f.intervenant, frequence: f.frequence, flexibilite: f.flexibilite, notes: f.notes, ref_origine: vue.ref_origine || '' };
      el.disabled = true; el.textContent = 'Envoi…';
      agir('nouvelle', args, function (r) { pile = []; vue = { v: 'accueil' }; api('etat').then(function () { afficher(); }); }).then(function (r) { if (!r || !r.ok) { el.disabled = false; el.textContent = 'Créer la demande'; } });
    },
    actif: function (x) { var k = cleaner(vue.id); agir('cleaner_actif', { id: k.id, actif: x === '1' }); },
    prefs: function (x) { agir('prefs', { notifications: x }); },
    vueami: function () { vueAmi = !vueAmi; ecrireLocal('vueAmi', vueAmi ? '1' : '0'); afficher(); },
    recharger: function () { api('etat').then(function () { toast('Rechargé'); afficher(); }); }
  };
  function confirmer(msg, oui) { if (tg && tg.showConfirm) tg.showConfirm(msg, function (ok) { if (ok) oui(); }); else if (window.confirm(msg)) oui(); }

  // ---------- Démarrage ----------
  if (tg) { try { tg.ready(); tg.expand(); document.documentElement.classList.add('tg'); } catch (e) {} }
  var q = new URLSearchParams(location.search);
  var v0 = q.get('v') || 'accueil', r0 = q.get('r') || '';
  if (q.get('f') === 'sans') filtre = 'sansTous';
  var depart = { accueil: { v: 'accueil' }, attribuer: { v: 'attribuer', r: r0 }, fiche: { v: 'fiche', r: r0 }, decaler: { v: 'decaler', r: r0 }, partager: { v: 'partager', r: r0 }, rereserver: null, nouvelle: { v: 'nouvelle' } }[v0] || { v: 'accueil' };
  if (r0 && v0 !== 'accueil') pile = [{ v: 'accueil' }, { v: 'fiche', r: r0 }].slice(0, v0 === 'fiche' ? 1 : 2);
  vue = depart || { v: 'accueil' };
  if (!initData && window.__DEMO) { E = window.__DEMO; afficher(); return; } // aperçu local uniquement
  if (!initData) { app.innerHTML = '<div class="bloc"><b>Ouvrez ce tableau de bord depuis le bot Telegram JeruServices.</b><p class="note">Pour votre sécurité, il ne fonctionne qu’à l’intérieur de Telegram.</p></div>'; return; }
  var cache = null; try { cache = JSON.parse(lireLocal('etat') || 'null'); } catch (e) {}
  if (cache && cache.demandes) { E = cache; if (v0 === 'rereserver') { ACTIONS.rereserver(r0); } else afficher(); }
  api('etat').then(function (r) {
    if (!r.ok) { app.innerHTML = '<div class="bloc"><b>' + esc(r.erreur || 'Accès refusé') + '</b></div>'; return; }
    window.__ms = r._ms; window.__ouverture = Math.round(performance.now() - T0);
    if (v0 === 'rereserver' && !cache) ACTIONS.rereserver(r0); else if (vue.v !== 'nouvelle') afficher();
    setTimeout(function () { api('mesure', { ouverture_ms: window.__ouverture, api_ms: r._ms, cache: !!cache, ua: navigator.userAgent.slice(0, 120) }); }, 400);
  }, function () { if (!E) app.innerHTML = '<div class="bloc"><b>Pas de connexion au serveur.</b><p class="note">Vérifiez Internet puis rouvrez. Les boutons du bot fonctionnent toujours.</p></div>'; else toast('Hors ligne : affichage de la dernière version connue', true); });
})();
