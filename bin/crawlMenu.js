#! /usr/bin/env node

'use strict';

var Linker = require('../lib');

if (process.argv.length > 2) {
    var l = new Linker({
        getLinks: false,
        getMenu: true,
        maxDepth: 1,
        menuKeywords: ['raspberry', 'mousse', 'parmesan', 'salad', 'chicken', 'egg', 'garlic', 'pork', 'pig', 'peanut', 'salmon', 'noodles',
            'curry', 'shrimp', 'coconut', 'soup', 'suey', 'tofu', 'mango', 'ice cream', 'squid', 'seafood', 'mussels', 'fish', 'cheese', 'potato', 'truffle',
            'marrow', 'duck', 'bbq', 'frite', 'tomato', 'parmesan', 'oatmeal', 'stout', 'beer', 'chives', 'arugula', 'onion', 'lemon', 'cream', 'spicy', 'coleslaw'],
        menuKeywordsBlacklisted: ['\\btry\\b', '\\bdiscover\\b', '\\bto\\b', '\\bfind\\b', '\\btaste\\b', '\\bwhen\\b', '\\byou\\b',
            '\\bmany\\b', '\\bhave\\b', '\\bis\\b', '\\bare\\b', '\\bit\\b',
            '\\bbefore\\b', '\\bchange\\b', '\\bprice\\b', '\\bwe\\b', '\\bthen\\b'],
        menuSelectors: ['p', 'span', '.menu', '.item', '#menu', '#item', '#menu-item', 'div']
    });
    var userArgs = process.argv.slice(2);

    l.crawl(userArgs[0])
    .progressed(function(res) {
        console.log('Progress: ', JSON.stringify(res, undefined, 2));
    })
    .finally(function(res) {
        //console.log('Results', JSON.stringify(l.menu, undefined, 2));
        console.log('Results count', l.menu.length);
    });

} else {
    console.log('Invalid args');
}
