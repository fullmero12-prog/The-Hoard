// ------------------------------------------------------------
// Boon Deck Data — Ancestors of the Hoard Run
// ------------------------------------------------------------
// Purpose:
//   Defines all Boon cards grouped by Ancestor and rarity.
//   This file is pure data and should be loaded before
//   BoonManager.register() so that decks are ready in memory.
// ------------------------------------------------------------

var BoonDataLoader = (function () {

  function fromRegistry() {
    if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry && typeof AncestorRegistry.getBoonDecks === 'function') {
      return AncestorRegistry.getBoonDecks();
    }
    return {};
  }

  function register() {
    if (!state.HoardRun) {
      state.HoardRun = {};
    }

    var decks = fromRegistry();
    state.HoardRun.boons = decks;

    var count = Object.keys(decks).length;
    if (count > 0) {
      log('[BoonDataLoader] Loaded ' + count + ' ancestor decks from registry.');
    } else {
      log('[BoonDataLoader] ⚠️ Registry returned no boon decks; state.HoardRun.boons is empty.');
    }
  }

  return {
    register: register
  };
})();

