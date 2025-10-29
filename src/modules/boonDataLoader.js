// ------------------------------------------------------------
// Boon Deck Data — Ancestors of the Hoard Run
// ------------------------------------------------------------
// Purpose:
//   Defines all Boon cards grouped by Ancestor and rarity.
//   This file is pure data and should be loaded before
//   BoonManager.register() so that decks are ready in memory.
// ------------------------------------------------------------

var BoonDataLoader = (function () {
  var root = (typeof globalThis !== 'undefined') ? globalThis : this;
  var logger = root.HRLog || null;

  function info(message) {
    if (logger && logger.info) {
      logger.info('BoonDataLoader', message);
    } else {
      log('[Hoard Run] [BoonDataLoader] ℹ️ ' + message);
    }
  }

  function warn(message) {
    if (logger && logger.warn) {
      logger.warn('BoonDataLoader', message);
    } else {
      log('[Hoard Run] [BoonDataLoader] ⚠️ ' + message);
    }
  }

  function buildDeckSource() {
    if (typeof BoonData !== 'undefined' && BoonData && typeof BoonData.getDecks === 'function') {
      return BoonData.getDecks();
    }

    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getBoonDecks === 'function') {
      return AncestorRegistry.getBoonDecks();
    }

    return {};
  }

  function register() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }

    var decks = buildDeckSource();
    state.HoardRun.boons = decks;

    var count = Object.keys(decks).length;
    if (count > 0) {
      info('Loaded ' + count + ' ancestor boon decks from catalog.');
    } else {
      warn('Boon catalog returned no decks; state.HoardRun.boons is empty.');
    }
  }

  return {
    register: register
  };
})();

