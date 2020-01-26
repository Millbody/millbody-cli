const fs = require("fs");
import { executeCommand, checkFolderBySource } from '../functions';

export default function executStart(options){
    const source = checkFolderBySource(options.source);
    if(source == 'theme'){
        executeCommand("cp millbodyApp.json ../../../ && cd ../../../ && npm start");
    }else{
        executeCommand("npm start");
    }
}