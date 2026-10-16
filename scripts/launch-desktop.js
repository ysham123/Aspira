import { exec } from 'node:child_process';

const HUD_URL = process.env.HUD_URL || 'http://localhost:5173';

console.log('\x1b[36m[A.R.C.H.O.N.] Launching Frameless Native macOS Visor Window...\x1b[0m');

// Attempt Chrome / Brave / Edge app-mode (chromeless native window on macOS), fallback to `open`
const commands = [
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="${HUD_URL}" --start-fullscreen --autoplay-policy=no-user-gesture-required`,
  `"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" --app="${HUD_URL}" --start-fullscreen --autoplay-policy=no-user-gesture-required`,
  `"/Applications/Arc.app/Contents/MacOS/Arc" "${HUD_URL}"`,
  `open "${HUD_URL}"`,
];

function tryNext(index) {
  if (index >= commands.length) return;
  exec(commands[index], (err) => {
    if (err && index + 1 < commands.length) {
      tryNext(index + 1);
    }
  });
}

tryNext(0);
