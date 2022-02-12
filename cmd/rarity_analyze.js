const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const collectionData = require(appRoot + '/config/' + config.collection_file_name);
const fs = require('fs');
const Database = require('better-sqlite3');
const _ = require('lodash');
const argv = require('minimist')(process.argv.slice(2),{
    string: ['mode'],
});

let mode = argv['mode'];

const databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (mode != 'force') { 
    if (fs.existsSync(databasePath)) {
        console.log("Database exist.");
        return;
    }
}

fs.writeFileSync(databasePath, '', { flag: 'w' });
console.log("Database created.");

const db = new Database(databasePath);

let totalWar = 0;
let traitTypeId = 0;
let traitDetailTypeId = 0;
let warTraitTypeId = 0;
let warScoreId = 0;

let traitTypeIdMap = {};
let traitTypeCount = {};
let traitDetailTypeIdMap = {};
let traitDetailTypeCount = {};
let warTraitTypeCount = {};

let ignoreTraits = config.ignore_traits.map(ignore_trait => ignore_trait.toLowerCase());

db.exec(
    "CREATE TABLE war (" +
        "id INT, " +
        "name TEXT, " +
        "description TEXT, " + 
        "image TEXT, " +
        "external_url TEXT, " +
        "animation_url TEXT " +
    ")"
);

db.exec(
    "CREATE TABLE trait_types (" +
        "id INT, " +
        "trait_type TEXT, " +
        "trait_data_type TEXT, " +
        "war_count INT " +
    ")"
);

db.exec(
    "CREATE TABLE trait_detail_types (" +
        "id INT, " +
        "trait_type_id INT, " +
        "trait_detail_type TEXT, " +
        "war_count INT " +
    ")"
);

db.exec(
    "CREATE TABLE war_traits (" +
        "id INT, " +
        "war_id INT, " +
        "trait_type_id INT, " + 
        "value TEXT " +
    ")"
);

db.exec(
    "CREATE TABLE war_trait_counts (" +
        "trait_count INT, " +
        "war_count INT " +
    ")"
);

let insertWarStmt = db.prepare("INSERT INTO war VALUES (?, ?, ?, ?, ?, ?)");
let insertTraitTypeStmt = db.prepare("INSERT INTO trait_types VALUES (?, ?, ?, ?)");
let insertTraitDetailTypeStmt = db.prepare("INSERT INTO trait_detail_types VALUES (?, ?, ?, ?)");
let insertPuntTraitStmt = db.prepare("INSERT INTO war_traits VALUES (?, ?, ?, ?)");

let count1 = config.collection_id_from;
collectionData.forEach(element => {

    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count1;
    }
    if (_.isEmpty(element.name)) {
        element['name'] = config.collection_name + ' #' + element.id;
    }
    if (!element.name.includes('#'+element.id)) {
        element['name'] = element['name'] + ' #' + (count1 + config.collection_id_from);
    }
    if (_.isEmpty(element.description)) {
        element['description'] = '';
    }
    if (_.isEmpty(element.external_url)) {
        element['external_url'] = '';
    }
    if (_.isEmpty(element.animation_url)) {
        element['animation_url'] = '';
    }

    console.log("Prepare war: #" + element.id);
    
    insertWarStmt.run(element.id, element.name, element.description, element.image, element.external_url, element.animation_url);

    let thisWarTraitTypes = [];

    if (_.isEmpty(element.attributes) && !_.isEmpty(element.traits)) {
        element.attributes = [];
        for (const [key, value] of Object.entries(element.traits)) {
            element.attributes.push(
                {
                    trait_type: key,
                    value: value
                }
            );
        }
    }

    // fake data for date
    /*
    element.attributes.push({
        value: '2456221590',
        trait_type: 'date',
        display_type: 'date',
    });
    */

    element.attributes.forEach(attribute => {

        if (attribute.value) {
            attribute.value = attribute.value.toString();
        }

        if (_.isEmpty(attribute.trait_type) || _.isEmpty(attribute.value) || attribute.value.toLowerCase() == 'none' || attribute.value.toLowerCase() == 'nothing' || attribute.value.toLowerCase() == '0') {
            return;
        }

        // Trait type
        if (!traitTypeCount.hasOwnProperty(attribute.trait_type)) {
            let traitDataType = 'string';
            if (!_.isEmpty(attribute.display_type) && attribute.display_type.toLowerCase() == 'date') {
                traitDataType = 'date';
            }
            insertTraitTypeStmt.run(traitTypeId, _.startCase(attribute.trait_type), traitDataType, 0);
            traitTypeIdMap[attribute.trait_type] = traitTypeId;
            traitTypeId = traitTypeId + 1;
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitTypeCount[attribute.trait_type] = 0 + 1;
            } else {
                traitTypeCount[attribute.trait_type] = 0;
            }
        } else {
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitTypeCount[attribute.trait_type] = traitTypeCount[attribute.trait_type] + 1;
            } else {
                traitTypeCount[attribute.trait_type] = 0;
            }
        }

        // Trait detail type
        if (!traitDetailTypeCount.hasOwnProperty(attribute.trait_type+'|||'+attribute.value)) {
            insertTraitDetailTypeStmt.run(traitDetailTypeId, traitTypeIdMap[attribute.trait_type], attribute.value, 0);
            traitDetailTypeIdMap[attribute.trait_type+'|||'+attribute.value] = traitDetailTypeId;
            traitDetailTypeId = traitDetailTypeId + 1;
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0 + 1;
            } else {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0;
            }
        } else {
            if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] + 1; 
            } else {
                traitDetailTypeCount[attribute.trait_type+'|||'+attribute.value] = 0;
            }  
        }

        insertPuntTraitStmt.run(warTraitTypeId, element.id, traitTypeIdMap[attribute.trait_type], attribute.value);  
        warTraitTypeId = warTraitTypeId + 1;
        
        if (!ignoreTraits.includes(attribute.trait_type.toLowerCase())) {
            thisWarTraitTypes.push(attribute.trait_type);
        }
    });

    if (!warTraitTypeCount.hasOwnProperty(thisWarTraitTypes.length)) {
        warTraitTypeCount[thisWarTraitTypes.length] = 0 + 1;
    } else {
        warTraitTypeCount[thisWarTraitTypes.length] = warTraitTypeCount[thisWarTraitTypes.length] + 1;
    }

    totalWar = totalWar + 1;
    count1 = count1 + 1;
});

console.log(traitTypeCount);
let updateTraitTypeStmt = db.prepare("UPDATE trait_types SET war_count = :war_count WHERE id = :id");
for(let traitType in traitTypeCount)
{
    let thisTraitTypeCount = traitTypeCount[traitType];
    let traitTypeId = traitTypeIdMap[traitType];
    updateTraitTypeStmt.run({
        war_count: thisTraitTypeCount,
        id: traitTypeId
    });
}
console.log(traitDetailTypeCount);
let updateTraitDetailTypeStmt = db.prepare("UPDATE trait_detail_types SET war_count = :war_count WHERE id = :id");
for(let traitDetailType in traitDetailTypeCount)
{
    let thisTraitDetailTypeCount = traitDetailTypeCount[traitDetailType];
    let traitDetailTypeId = traitDetailTypeIdMap[traitDetailType];
    updateTraitDetailTypeStmt.run({
        war_count: thisTraitDetailTypeCount,
        id: traitDetailTypeId
    });
}
console.log(warTraitTypeCount);
let insertWarTraitContStmt = db.prepare("INSERT INTO war_trait_counts VALUES (?, ?)");
for(let countType in warTraitTypeCount)
{
    let thisTypeCount = warTraitTypeCount[countType];
    insertWarTraitContStmt.run(countType, thisTypeCount);
}

let createScoreTableStmt = "CREATE TABLE war_scores ( id INT, war_id INT, ";
let insertWarScoreStmt = "INSERT INTO war_scores VALUES (:id, :war_id, ";

for (let i = 0; i < traitTypeId; i++) {
    createScoreTableStmt = createScoreTableStmt + "trait_type_" + i + "_percentile DOUBLE, trait_type_" + i + "_rarity DOUBLE, trait_type_" + i + "_value TEXT, ";
    insertWarScoreStmt = insertWarScoreStmt + ":trait_type_" + i + "_percentile, :trait_type_" + i + "_rarity, :trait_type_" + i + "_value, ";
}

createScoreTableStmt = createScoreTableStmt + "trait_count INT,  trait_count_percentile DOUBLE, trait_count_rarity DOUBLE, rarity_sum DOUBLE, rarity_rank INT)";
insertWarScoreStmt = insertWarScoreStmt + ":trait_count,  :trait_count_percentile, :trait_count_rarity, :rarity_sum, :rarity_rank)";

db.exec(createScoreTableStmt);
insertWarScoreStmt = db.prepare(insertWarScoreStmt);

let count2 = config.collection_id_from;
collectionData.forEach(element => {
    
    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count2;
    }

    console.log("Analyze war: #" + element.id);

    let thisWarTraitTypes = [];
    let thisWarDetailTraits = {};

    if (_.isEmpty(element.attributes) && !_.isEmpty(element.traits)) {
        element.attributes = [];
        for (const [key, value] of Object.entries(element.traits)) {
            element.attributes.push(
                {
                    trait_type: key,
                    value: value
                }
            );
        }
    }

    element.attributes.forEach(attribute => {

        if (attribute.value) {
            attribute.value = attribute.value.toString();
        }
        
        if (_.isEmpty(attribute.trait_type) || _.isEmpty(attribute.value) || attribute.value.toLowerCase() == 'none' || attribute.value.toLowerCase() == 'nothing' || attribute.value.toLowerCase() == '0') {
            return;
        }

        thisWarTraitTypes.push(attribute.trait_type);
        thisWarDetailTraits[attribute.trait_type] = attribute.value;
    });

    let warScore = {};
    let raritySum = 0;
    warScore['id'] = warScoreId;
    warScore['war_id'] = element.id;
    for(let traitType in traitTypeCount)
    {
        
        if (thisWarTraitTypes.includes(traitType)) {
            // has trait
            let traitDetailType = thisWarDetailTraits[traitType];
            let thisTraitDetailTypeCount = traitDetailTypeCount[traitType+'|||'+traitDetailType];
            let traitTypeId = traitTypeIdMap[traitType];
            if (!ignoreTraits.includes(traitType.toLowerCase())) {
                warScore['trait_type_' + traitTypeId + '_percentile'] = thisTraitDetailTypeCount/totalWar;
                warScore['trait_type_' + traitTypeId + '_rarity'] = totalWar/thisTraitDetailTypeCount;
                raritySum = raritySum + totalWar/thisTraitDetailTypeCount;
            } else {
                warScore['trait_type_' + traitTypeId + '_percentile'] = 0;
                warScore['trait_type_' + traitTypeId + '_rarity'] = 0;
                raritySum = raritySum + 0;
            }
            warScore['trait_type_' + traitTypeId + '_value'] = traitDetailType;
        } else {   
            // missing trait
            let thisTraitTypeCount = traitTypeCount[traitType];
            let traitTypeId = traitTypeIdMap[traitType];
            if (!ignoreTraits.includes(traitType.toLowerCase())) {
                warScore['trait_type_' + traitTypeId + '_percentile'] = (totalWar-thisTraitTypeCount)/totalWar;
                warScore['trait_type_' + traitTypeId + '_rarity'] = totalWar/(totalWar-thisTraitTypeCount);
                raritySum = raritySum + totalWar/(totalWar-thisTraitTypeCount);
            } else {
                warScore['trait_type_' + traitTypeId + '_percentile'] = 0;
                warScore['trait_type_' + traitTypeId + '_rarity'] = 0;
                raritySum = raritySum + 0;
            }
            warScore['trait_type_' + traitTypeId + '_value'] = 'None';
        }
    }


    thisWarTraitTypes = thisWarTraitTypes.filter(thisWarTraitType => !ignoreTraits.includes(thisWarTraitType));
    let thisWarTraitTypeCount = thisWarTraitTypes.length;

    warScore['trait_count'] = thisWarTraitTypeCount;
    warScore['trait_count_percentile'] = warTraitTypeCount[thisWarTraitTypeCount]/totalWar;
    warScore['trait_count_rarity'] = totalWar/warTraitTypeCount[thisWarTraitTypeCount];
    raritySum = raritySum + totalWar/warTraitTypeCount[thisWarTraitTypeCount];
    warScore['rarity_sum'] = raritySum;
    warScore['rarity_rank'] = 0;

    insertWarScoreStmt.run(warScore);

    warScoreId = warScoreId + 1;
    count2 = count2 + 1;
});

const warScoreStmt = db.prepare('SELECT rarity_sum FROM war_scores WHERE war_id = ?');
const warRankStmt = db.prepare('SELECT COUNT(id) as higherRank FROM war_scores WHERE rarity_sum > ?');
let updatWarRankStmt = db.prepare("UPDATE war_scores SET rarity_rank = :rarity_rank WHERE war_id = :war_id");

let count3 = config.collection_id_from;
collectionData.forEach(element => {
    if (element.id != undefined) {
        element.id = element.id.toString();
    }
    if (_.isEmpty(element.id)) {
        element['id'] = count3;
    }

    console.log("Ranking war: #" + element.id);
    let warScore = warScoreStmt.get(element.id);
    let warRank = warRankStmt.get(warScore.rarity_sum);
    updatWarRankStmt.run({
        rarity_rank: warRank.higherRank+1,
        war_id: element.id
    });
    count3 = count3 + 1;
});
