import fs from "fs";

import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executStart(options) {
  const source = checkFolderBySource(options.source);
  if (source == "theme") {
    executeCommand(
      "cp millbodyApp.json ../../../ && cd ../../../ && npm start --reset-cache"
    );
  } else {
    executeCommand("npx react-native start --reset-cache");
  }
}
