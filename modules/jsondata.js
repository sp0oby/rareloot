const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const fs = require('fs');
const Database = require('better-sqlite3');
const _ = require('lodash');

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);

exports.war = function (war, scoreTable) {
  let warId = war.id;
  let warTraits = db.prepare('SELECT war_traits.trait_type_id, trait_types.trait_type, war_traits.value  FROM war_traits INNER JOIN trait_types ON (war_traits.trait_type_id = trait_types.id) WHERE war_traits.war_id = ?').all(warId);
  let warScore = db.prepare('SELECT '+scoreTable+'.* FROM '+scoreTable+' WHERE '+scoreTable+'.war_id = ?').get(warId);
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  
  let warTraitsData = [];
  let warTraitIDs = [];
  warTraits.forEach(warTrait => {
    let percentile = warScore['trait_type_'+warTrait.trait_type_id+'_percentile'];
    let rarity_score = warScore['trait_type_'+warTrait.trait_type_id+'_rarity'];
    warTraitsData.push({
      trait_type: warTrait.trait_type,
      value: warTrait.value,
      percentile: percentile,
      rarity_score: rarity_score,
    });
    warTraitIDs.push(warTrait.trait_type_id);
  });

  let missingTraitsData = [];
  allTraitTypes.forEach(traitType => {
    if (!warTraitIDs.includes(traitType.id)) {
      let percentile = warScore['trait_type_'+traitType.id+'_percentile'];
      let rarity_score = warScore['trait_type_'+traitType.id+'_rarity'];
      missingTraitsData.push({
        trait_type: traitType.trait_type,
        percentile: percentile,
        rarity_score: rarity_score,
      });
    }
  });

  return {
    id: war.id,
    name: war.name,
    image: war.image,
    attributes: warTraitsData,
    missing_traits: missingTraitsData,
    trait_count: {
      count: warScore.trait_count,
      percentile: warScore.trait_count_percentile,
      rarity_score: warScore.trait_count_rarity
    },
    rarity_score: warScore.rarity_sum,
    rarity_rank: warScore.rarity_rank
  };
};
