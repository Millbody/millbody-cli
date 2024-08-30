import fs from "fs";

import { executeCommand, checkFolderBySource } from "../functions.js";

export default function executCodePush(options) {
  const source = checkFolderBySource(options.source);
  if (source == "theme") {
    executeCommand(
      "cd ../../../ && node ./mbCore/framework/script.js codepush deploy"
    );
  } else {
    executeCommand("node ./mbCore/framework/script.js codepush deploy");
  }
  console.log("publicando pelo CodePush...");
}
