const fs = require("fs");
import { executeCommand, checkFolderBySource } from '../functions';

export default function executeRunAndroid(options){
    const source = checkFolderBySource(options.source);
    if(source == 'theme'){
        executeCommand("cd ../../../ && cd android/ && ./gradlew clean && cd .. && react-native run-android");
    }else{
        executeCommand("cd android/ && ./gradlew clean && cd .. && react-native run-android");
    }
    console.log('Limpando cache e rodando android...')
}