const config = {
    app_name: 'WAR RARITY',
    app_description: 'Check out the rarity of your FORCES from Loot (for War)',
    collection_file_name: 'collection.json',
    collection_contract_address: '0xAd60229eCdC4b907F0e2152ba18e284cCBfCb261',
    collection_name: 'Loot (for War)',
    collection_description: 'Loot for WAR is our NFT collection of 6000 uniquely generated Force Cards all on chain.',
    collection_id_from: 1,
    ignore_traits: ['date'], 
    sqlite_file_name: 'database.sqlite',
    ga: 'G-BW69Z04YTP',
    main_og_image: 'https://onedaypunk-rarity-tool.herokuapp.com/images/og.png',
    item_path_name: 'war',
    page_item_num: 60,
    content_image_is_video: false,
    content_image_frame: 'square', // circle, rectangle
    use_wallet: true
};

module.exports = config;