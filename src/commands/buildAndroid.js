const fs = require("fs");
import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executeBuildAndroid(options) {
  const source = checkFolderBySource(options.source);
  if (source == "theme") {
    executeCommand(
      "cd ../../../ && cd android/ && ./gradlew clean && ./gradlew assembleRelease"
    );
  } else {
    executeCommand(
      "cd android/ && ./gradlew clean && ./gradlew assembleRelease"
    );
  }
  console.log("Limpando cache e buildando android...");
}
