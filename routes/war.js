const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const express = require('express');
const router = express.Router();
const fs = require('fs');
const Database = require('better-sqlite3');
const jsondata = require(appRoot + '/modules/jsondata.js');
const _ = require('lodash');
const MarkdownIt = require('markdown-it'),
    md = new MarkdownIt();

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);

/* GET war listing. */
router.get('/:id', function(req, res, next) {
  let warId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'war_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_war_scores';
  } else {
    useTraitNormalization = '0';
  }

  let war = db.prepare('SELECT war.*, '+scoreTable+'.rarity_rank FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) WHERE war.id = ?').get(warId);
  let warScore = db.prepare('SELECT '+scoreTable+'.* FROM '+scoreTable+' WHERE '+scoreTable+'.war_id = ?').get(warId);
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let allDetailTraitTypes = db.prepare('SELECT trait_detail_types.* FROM trait_detail_types').all();
  let allTraitCountTypes = db.prepare('SELECT war_trait_counts.* FROM war_trait_counts').all();

  let warTraits = db.prepare('SELECT war_traits.*, trait_types.trait_type  FROM war_traits INNER JOIN trait_types ON (war_traits.trait_type_id = trait_types.id) WHERE war_traits.war_id = ?').all(warId);
  let totalWarCount = db.prepare('SELECT COUNT(id) as war_total FROM war').get().war_total;

  let warTraitData = {};
  let ignoredWarTraitData = {};
  let ignoreTraits = config.ignore_traits.map(ignore_trait => ignore_trait.toLowerCase());
  warTraits.forEach(warTrait => {
    warTraitData[warTrait.trait_type_id] = warTrait.value;

    if (!ignoreTraits.includes(warTrait.trait_type.toLowerCase())) {
      ignoredWarTraitData[warTrait.trait_type_id] = warTrait.value;
    }
  });

  let allDetailTraitTypesData = {};
  allDetailTraitTypes.forEach(detailTrait => {
    allDetailTraitTypesData[detailTrait.trait_type_id+'|||'+detailTrait.trait_detail_type] = detailTrait.war_count;
  });

  let allTraitCountTypesData = {};
  allTraitCountTypes.forEach(traitCount => {
    allTraitCountTypesData[traitCount.trait_count] = traitCount.war_count;
  });

  let title = config.collection_name + ' | ' + config.app_name;
  //let description = config.collection_description + ' | ' + config.app_description
  let description = war ? `💎 ID: ${ war.id }
    💎 Rarity Rank: ${ war.rarity_rank }
    💎 Rarity Score: ${ warScore.rarity_sum.toFixed(2) }` : '';

  if (!_.isEmpty(war)) {
    title = war.name + ' | ' + config.app_name;
  }
  
  res.render('war', { 
    appTitle: title,
    appDescription: description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: war,
    activeTab: 'rarity',
    war: war, 
    warScore: warScore, 
    allTraitTypes: allTraitTypes, 
    allDetailTraitTypesData: allDetailTraitTypesData, 
    allTraitCountTypesData: allTraitCountTypesData, 
    warTraitData: warTraitData, 
    ignoredWarTraitData: ignoredWarTraitData,
    totalWarCount: totalWarCount, 
    trait_normalization: useTraitNormalization,
    _: _,
    md: md
  });
});

router.get('/:id/json', function(req, res, next) {
  let warId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'war_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_war_scores';
  } else {
    useTraitNormalization = '0';
  }

  let war = db.prepare('SELECT war.*, '+scoreTable+'.rarity_rank FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) WHERE war.id = ?').get(warId);
  
  if (_.isEmpty(war)) {
    res.end(JSON.stringify({
      status: 'fail',
      message: 'not_exist',
    }));
  }

  let warData = jsondata.war(war, scoreTable);
  
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    status: 'success',
    message: 'success',
    war: warData
  }));
});

router.get('/:id/similar', function(req, res, next) {
  let warId = req.params.id;
  let useTraitNormalization = req.query.trait_normalization;

  let scoreTable = 'war_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_war_scores';
  } else {
    useTraitNormalization = '0';
  }

  let war = db.prepare('SELECT war.*, '+scoreTable+'.rarity_rank FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) WHERE war.id = ?').get(warId);
  let warScore = db.prepare('SELECT '+scoreTable+'.* FROM '+scoreTable+' WHERE '+scoreTable+'.war_id = ?').get(warId);
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let similarCondition = '';
  let similarTo = {};
  let similarWars = null;
  if (warScore) {
    allTraitTypes.forEach(traitType => {
      similarCondition = similarCondition + 'IIF('+scoreTable+'.trait_type_'+traitType.id+'_value = :trait_type_'+traitType.id+', 1 * '+scoreTable+'.trait_type_'+traitType.id+'_rarity, 0) + ';
      similarTo['trait_type_'+traitType.id] = warScore['trait_type_'+traitType.id+'_value'];
    });
    similarTo['trait_count'] = warScore['trait_count'];
    similarTo['this_war_id'] = warId;
    similarWars = db.prepare(`
      SELECT
        war.*,
        `+scoreTable+`.war_id, 
        (
          ` 
          + similarCondition +
          `
          IIF(`+scoreTable+`.trait_count = :trait_count, 1 * 0, 0)
        )
        similar 
      FROM `+scoreTable+`  
      INNER JOIN war ON (`+scoreTable+`.war_id = war.id)
      WHERE `+scoreTable+`.war_id != :this_war_id
      ORDER BY similar desc
      LIMIT 12
      `).all(similarTo);
  }

  
  let title = config.collection_name + ' | ' + config.app_name;
  let description = config.collection_description + ' | ' + config.app_description
  if (!_.isEmpty(war)) {
    title = war.name + ' | ' + config.app_name;
  }

  res.render('similar_war', { 
    appTitle: title,
    appDescription: description,
    ogTitle: title,
    ogDescription: description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: war,
    activeTab: 'rarity',
    war: war,
    similarWars: similarWars,
    trait_normalization: useTraitNormalization,
    _: _
  });
});

module.exports = router;
