# Roll20 Sandbox Debugging Checklist

This guide captures the quick checks we run whenever the Hoard Run mod fails to respond inside the Roll20 API sandbox. Follow the steps in order so we can isolate the failure point quickly.

## 1. Confirm the `on('ready')` Hook Loads
* Open `main.js` in the Mods editor and ensure it contains the ready hook near the top or bottom of the file:

```js
on('ready', () => {
  log('=== Hoard Run v1.0.0 initialized ===');
  sendChat('Hoard Run', '/w gm ✅ Hoard Run ready. Type !startrun to begin.');
});
```

* If the block is missing, add it back, save the script, and press **Restart Sandbox**. You should see `[Hoard Run] ready` in both the Mod Output Console and chat when it boots correctly.

## 2. Scan the Mod Output Console for Syntax Errors
* Scroll to the bottom of the Mod Output Console and look for red or yellow errors such as `SyntaxError: Unexpected token` or `ReferenceError: RelicDecks is not defined`.
* Any error here stops the sandbox from registering event listeners. Fix the reported line (usually a missing comma or brace when converting JSON to JavaScript) and restart the sandbox before testing again.

## 3. Verify `sendChat` Output Visibility
* Temporarily swap the whisper for a public message:

```js
sendChat('Hoard Run', '✅ Hoard Run ready.');
```

* Reload the sandbox. If the message appears publicly, the mod is running and only the GM whisper was hidden.

## 4. Force-Test the Chat Listener
* Add the diagnostic listener near the top of your script:

```js
on('chat:message', (msg) => {
  if (msg.type === 'api') {
    log(`[Chat] Command detected: ${msg.content}`);
    sendChat('Debug', `Received: ${msg.content}`);
  }
});
```

* Type `!test` (or any command starting with `!`) in Roll20 chat. Seeing `Received: !test` confirms the listener system is active. If nothing appears, the sandbox never registered the handlers—return to step 2 for hidden errors.

## 5. Watch for Conflicting Ready Hooks
* Duplicate `on('ready')` hooks are fine, but mismatched braces or duplicate variable declarations can halt the script before it finishes parsing.
* Review recent edits for stray braces or redeclared top-level variables before restarting the sandbox.

Document any persistent errors so we can reproduce and patch them in the repository.
