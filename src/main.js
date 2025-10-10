// ------------------------------------------------------------
// main.js — Hoard Run Unified Bootstrap
// ------------------------------------------------------------
// Purpose:
//   Centralized system startup for all Hoard Run modules.
//   Ensures consistent load order and triggers Roll20-ready messaging.
// ------------------------------------------------------------

on('ready', function () {
  LogManager.register && LogManager.register();
  SafetyGuards.register && SafetyGuards.register();
  UIManager.register && UIManager.register();

  EffectAdapters.register && EffectAdapters.register();   // register concrete adapters first
  EffectEngine.register && EffectEngine.register();       // then engine that uses them
  SpellbookHelper.register && SpellbookHelper.register();

  AncestorRegistry.register && AncestorRegistry.register();
  BoonDataLoader.register && BoonDataLoader.register();
  DeckManager.register && DeckManager.register();

  BoonManager.register && BoonManager.register();
  ShopManager.register && ShopManager.register();
  RoomManager.register && RoomManager.register();
  RunFlowManager.register && RunFlowManager.register();
  DevTools.register && DevTools.register();

  sendChat('Hoard Run','/w gm ✅ Hoard loaded. Use !startrun to begin.');
});
