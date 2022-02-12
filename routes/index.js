const appRoot = require('app-root-path');
const config = require(appRoot + '/config/config.js');
const request = require('sync-request');
const express = require('express');
const router = express.Router();
const Web3 = require('web3');
const fs = require('fs');
const Database = require('better-sqlite3');
const _ = require('lodash');

let databasePath = appRoot + '/config/' + config.sqlite_file_name;

if (!fs.existsSync(databasePath)) {
  databasePath = appRoot + '/config/database.sqlite.sample';
}

const db = new Database(databasePath);

/* GET home page. */
router.get('/', function(req, res, next) {

  let search = req.query.search;
  let traits = req.query.traits;
  let useTraitNormalization = req.query.trait_normalization;
  let orderBy = req.query.order_by;
  let page = req.query.page;

  let offset = 0;
  let limit = config.page_item_num;

  if (_.isEmpty(search)) {
    search = '';
  }

  if (_.isEmpty(traits)) {
    traits = '';
  }

  let scoreTable = 'war_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_war_scores';
  } else {
    useTraitNormalization = '0';
  }

  if (orderBy == 'rarity' || orderBy == 'id') {
    orderBy = orderBy;
  } else {
    orderBy = 'rarity';
  }

  if (!_.isEmpty(page)) {
    page = parseInt(page);
    if (!isNaN(page)) {
      offset = (Math.abs(page) - 1) * limit;
    } else {
      page = 1;
    }
  } else {
    page = 1;
  }

  let selectedTraits = (traits != '') ? traits.split(',') : [];
  let totalWarCount = 0
  let war = null;
  let orderByStmt = '';
  if (orderBy == 'rarity') {
    orderByStmt = 'ORDER BY '+scoreTable+'.rarity_rank ASC';
  } else {
    orderByStmt = 'ORDER BY war.id ASC';
  }

  let totalSupply = db.prepare('SELECT COUNT(war.id) as war_total FROM war').get().war_total;
  let allTraitTypes = db.prepare('SELECT trait_types.* FROM trait_types').all();
  let allTraitTypesData = {};
  allTraitTypes.forEach(traitType => {
    allTraitTypesData[traitType.trait_type] = traitType.war_count;
  });

  let allTraits = db.prepare('SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.war_count, trait_detail_types.trait_type_id, trait_detail_types.id trait_detail_type_id  FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.war_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type').all();
  let totalWarCountQuery = 'SELECT COUNT(war.id) as war_total FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) ';
  let warQuery = 'SELECT war.*, '+scoreTable+'.rarity_rank FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) ';
  let totalWarCountQueryValue = {};
  let warQueryValue = {};

  if (!_.isEmpty(search)) {
    search = parseInt(search);
    totalWarCountQuery = totalWarCountQuery+' WHERE war.id LIKE :war_id ';
    totalWarCountQueryValue['war_id'] = '%'+search+'%';

    warQuery = warQuery+' WHERE war.id LIKE :war_id ';
    warQueryValue['war_id'] = '%'+search+'%';
  } else {
    totalWarCount = totalWarCount;
  }

  let allTraitTypeIds = [];
  allTraits.forEach(trait => {
    if (!allTraitTypeIds.includes(trait.trait_type_id.toString())) {
      allTraitTypeIds.push(trait.trait_type_id.toString());
    }
  }); 

  let purifySelectedTraits = [];
  if (selectedTraits.length > 0) {

    selectedTraits.map(selectedTrait => {
      selectedTrait = selectedTrait.split('_');
      if ( allTraitTypeIds.includes(selectedTrait[0]) ) {
        purifySelectedTraits.push(selectedTrait[0]+'_'+selectedTrait[1]);
      }
    });

    if (purifySelectedTraits.length > 0) {
      if (!_.isEmpty(search.toString())) {
        totalWarCountQuery = totalwarCountQuery + ' AND ';
        warQuery = warQuery + ' AND ';
      } else {
        totalWarCountQuery = totalWarCountQuery + ' WHERE ';
        warQuery = warQuery + ' WHERE ';
      }
      let count = 0;

      purifySelectedTraits.forEach(selectedTrait => {
        selectedTrait = selectedTrait.split('_');
        totalWarCountQuery = totalWarCountQuery+' '+scoreTable+'.trait_type_'+selectedTrait[0]+'_value = :trait_type_'+selectedTrait[0]+'_value ';
        warQuery = warQuery+' '+scoreTable+'.trait_type_'+selectedTrait[0]+'_value = :trait_type_'+selectedTrait[0]+'_value ';
        if (count != (purifySelectedTraits.length-1)) {
          totalWarCountQuery = totalWarCountQuery + ' AND ';
          warQuery = warQuery + ' AND ';
        }
        count++;

        totalWarCountQueryValue['trait_type_'+selectedTrait[0]+'_value'] = selectedTrait[1];
        warQueryValue['trait_type_'+selectedTrait[0]+'_value'] = selectedTrait[1];    
      });
    }
  }
  let purifyTraits = purifySelectedTraits.join(',');

  warQuery = warQuery+' '+orderByStmt+' LIMIT :offset,:limit';
  warQueryValue['offset'] = offset;
  warQueryValue['limit'] = limit;

  totalWarCount = db.prepare(totalWarCountQuery).get(totalWarCountQueryValue).war_total;
  war = db.prepare(warQuery).all(warQueryValue);

  let totalPage =  Math.ceil(totalWarCount/limit);

  res.render('index', { 
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'rarity',
    war: war, 
    totalWarCount: totalWarCount,
    totalPage: totalPage, 
    search: search, 
    useTraitNormalization: useTraitNormalization,
    orderBy: orderBy,
    traits: purifyTraits,
    selectedTraits: purifySelectedTraits,
    allTraits: allTraits,
    page: page,
    totalSupply: totalSupply,
    allTraitTypesData: allTraitTypesData,
    _:_ 
  });
});

router.get('/matrix', function(req, res, next) {

  let allTraits = db.prepare('SELECT trait_types.trait_type, trait_detail_types.trait_detail_type, trait_detail_types.war_count FROM trait_detail_types INNER JOIN trait_types ON (trait_detail_types.trait_type_id = trait_types.id) WHERE trait_detail_types.war_count != 0 ORDER BY trait_types.trait_type, trait_detail_types.trait_detail_type').all();
  let allTraitCounts = db.prepare('SELECT * FROM war_trait_counts WHERE war_count != 0 ORDER BY trait_count').all();
  let totalWarCount = db.prepare('SELECT COUNT(id) as war_total FROM war').get().war_total;

  res.render('matrix', {
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'matrix',
    allTraits: allTraits,
    allTraitCounts: allTraitCounts,
    totalWarCount: totalWarCount,
    _:_ 
  });
});

router.get('/wallet', function(req, res, next) {
  let search = req.query.search;
  let useTraitNormalization = req.query.trait_normalization;

  if (_.isEmpty(search)) {
    search = '';
  }

  let scoreTable = 'war_scores';
  if (useTraitNormalization == '1') {
    useTraitNormalization = '1';
    scoreTable = 'normalized_war_scores';
  } else {
    useTraitNormalization = '0';
  }

  let isAddress = Web3.utils.isAddress(search);
  let tokenIds = [];
  let war = null;
  if (isAddress) {
    let url = 'https://api.dirtypantiecape.xyz/address/'+search+'/dirtypantiecapes';
    let result = request('GET', url);
    let data = result.getBody('utf8');
    data = JSON.parse(data);
    data.forEach(element => {
      tokenIds.push(element.token_id);
    });
    if (tokenIds.length > 0) {
      let warQuery = 'SELECT war.*, '+scoreTable+'.rarity_rank FROM war INNER JOIN '+scoreTable+' ON (war.id = '+scoreTable+'.war_id) WHERE war.id IN ('+tokenIds.join(',')+') ORDER BY '+scoreTable+'.rarity_rank ASC';
      war = db.prepare(warQuery).all();
    }
  }

  res.render('wallet', {
    appTitle: config.app_name,
    appDescription: config.app_description,
    ogTitle: config.collection_name + ' | ' + config.app_name,
    ogDescription: config.collection_description + ' | ' + config.app_description,
    ogUrl: req.protocol + '://' + req.get('host') + req.originalUrl,
    ogImage: config.main_og_image,
    activeTab: 'wallet',
    war: war,
    search: search, 
    useTraitNormalization: useTraitNormalization,
    _:_ 
  });
});

module.exports = router;
