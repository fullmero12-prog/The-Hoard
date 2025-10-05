// ------------------------------------------------------------
// UI Manager
// ------------------------------------------------------------
// What this does (in simple terms):
//   Centralizes all chat output formatting.
//   Lets you style messages consistently across modules.
//   Provides simple wrappers for headers, menus, and alerts.
//
//   Think of it as the "front-end theme" for your Roll20 mod.
// ------------------------------------------------------------

var UIManager = (function () {

  // ------------------------------------------------------------
  // Basic Style Templates
  // ------------------------------------------------------------
  var COLORS = {
    bg: '#1a1a1a',
    border: '#555',
    text: '#eee',
    accent: '#c2a347'
  };

  /**
   * Creates a bordered chat box with title and content.
   * @param {string} title
   * @param {string} bodyHTML
   * @returns {string} HTML block
   */
  function panel(title, bodyHTML) {
    return '**' + title + '**\n' + bodyHTML;
  }

  /**
   * Creates a list of buttons.
   * @param {Array<{label:string,command:string}>} buttons
   * @returns {string}
   */
  function buttons(buttons) {
    return buttons.map(function (b) {
      var command = (b.command || '').replace(/^!/, '');
      return '[' + b.label + '](!' + command + ')';
    }).join('<br>');
  }

  /**
   * Sends a styled whisper to a player.
   * @param {string} playerName
   * @param {string} title
   * @param {string} bodyHTML
   */
  function whisper(playerName, title, bodyHTML) {
    sendChat('Hoard Run', '/w ' + playerName + ' ' + panel(title, bodyHTML));
  }

  /**
   * Broadcasts a system message to the GM only.
   * @param {string} msg
   */
  function gmLog(msg) {
    sendChat('Hoard Run', '/w gm ' + msg);
  }

  // ------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------
  return {
    panel: panel,
    buttons: buttons,
    whisper: whisper,
    gmLog: gmLog
  };

})();
