const fs = require("fs");
import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executeRunAndroid(options) {
  const source = checkFolderBySource(options.source);
  if (source == "theme") {
    executeCommand("cd ../../../ && react-native run-ios");
  } else {
    executeCommand("react-native run-ios");
  }
  console.log("Rodando aplicação no iOS...");
}
