const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const Database = require('better-sqlite3');
const jsondata = require(appRoot + '/modules/jsondata.js');
const fs = require('fs');

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);
const outputPath = appRoot + '/config/collection-rarities.json';

fs.truncateSync(outputPath);

const logger = fs.createWriteStream(outputPath, {
  flags: 'a'
});

logger.write("[\n");

let totalWarCount = db.prepare('SELECT COUNT(id) as war_total FROM war').get().war_total;
let war = db.prepare('SELECT war.* FROM war ORDER BY id').all();

let count = 0;
war.forEach(war => {
    console.log("Process war: #" + war.id);
    if ((count+1) == totalWarCount) {
        logger.write(JSON.stringify(jsondata.war(war))+"\n");
    } else {
        logger.write(JSON.stringify(jsondata.war(war))+",\n");
    }
    count++
});

logger.write("]");

logger.end();
