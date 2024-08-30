const fs = require("fs");
import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executeRunAndroid(options) {
  const source = checkFolderBySource(options.source);
  const millbodyApp = JSON.parse(fs.readFileSync("millbodyApp.json"));
  console.log("Rodando APP " + millbodyApp.account + " no Android");
  if (source == "theme") {
    executeCommand(
      "cd ../../../ && cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android"
    );
  } else {
    executeCommand(
      "cd android/ && ./gradlew clean && cd .. && ENVFILE=.env react-native run-android"
    );
  }
  console.log("Limpando cache e rodando android...");
}
