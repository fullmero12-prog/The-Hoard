// ------------------------------------------------------------
// main.js — Hoard Run Unified Bootstrap
// ------------------------------------------------------------
// Purpose:
//   Centralized system startup for all Hoard Run modules.
//   Ensures consistent load order and triggers Roll20-ready messaging.
// ------------------------------------------------------------

on('ready', function () {
  if (typeof LogManager !== 'undefined' && LogManager.register) {
    LogManager.register();
  }

  if (typeof SafetyGuards !== 'undefined' && SafetyGuards.register) {
    SafetyGuards.register();
  }

  if (typeof UIManager !== 'undefined' && UIManager.register) {
    UIManager.register();
  }

  if (typeof AttributeManager !== 'undefined' && AttributeManager.register) {
    AttributeManager.register();
  }

  if (typeof SpellbookHelper !== 'undefined' && SpellbookHelper.register) {
    SpellbookHelper.register();
  }

  if (typeof AncestorRegistry !== 'undefined' && AncestorRegistry.register) {
    AncestorRegistry.register();
  }

  if (typeof BoonDataLoader !== 'undefined' && BoonDataLoader.register) {
    BoonDataLoader.register();
  }

  if (typeof DeckManager !== 'undefined' && DeckManager.register) {
    DeckManager.register();
  }

  if (typeof BoonManager !== 'undefined' && BoonManager.register) {
    BoonManager.register();
  }

  if (typeof ShopManager !== 'undefined' && ShopManager.register) {
    ShopManager.register();
  }

  if (typeof RoomManager !== 'undefined' && RoomManager.register) {
    RoomManager.register();
  }

  if (typeof RunFlowManager !== 'undefined' && RunFlowManager.register) {
    RunFlowManager.register();
  }

  if (typeof DevTools !== 'undefined' && DevTools.register) {
    DevTools.register();
  }

  sendChat('Hoard Run','/w gm ✅ Hoard loaded. Use !startrun to begin.');
});
