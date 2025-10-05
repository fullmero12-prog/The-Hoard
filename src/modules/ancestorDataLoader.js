// ------------------------------------------------------------
// Ancestor Data Loader
// ------------------------------------------------------------
// What this does (in simple terms):
//   Stores flavor information for each Ancestor inline so the
//   Roll20 sandbox can serve quick lookups without external files.
//   Provides a simple helper to fetch an Ancestor's title and
//   summary for use in chat output and UI prompts.
// ------------------------------------------------------------

var AncestorDataLoader = (function () {

  var AncestorData = {
    'Azuren': {
      title: 'The Stormheart',
      summary: 'Master of wind and storm. Empowers mobility, deflection, and ranged control.'
    },
    'Sutra Vayla': {
      title: 'The Timebinder',
      summary: 'Chronomancer who manipulates tempo and shields allies from fate.'
    },
    'Seraphine Emberwright': {
      title: 'The Forgelight',
      summary: 'Radiant artist who channels flame into healing, renewal, and creative power.'
    },
    'Vladren Moroi': {
      title: 'The Blood Regent',
      summary: 'Vampiric tactician who thrives on sacrifice and relentless aggression.'
    },
    'Lian Veilbinder': {
      title: 'The Duelist',
      summary: 'Weaver of illusions and blade, combining elegance with deadly precision.'
    },
    'Morvox, Tiny Tyrant': {
      title: 'The Miniature Monarch',
      summary: 'Small body, massive ego. Commands minions, chaos, and unearned confidence.'
    }
  };

  on('ready', function () {
    log('[AncestorDataLoader] Loaded ' + Object.keys(AncestorData).length + ' ancestors.');
  });

  return {
    get: function (name) {
      return AncestorData[name];
    }
  };

})();
