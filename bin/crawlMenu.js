#! /usr/bin/env node

'use strict';

var Linker = require('../lib'),
    MenuProcessor = require('../lib/processors/menu');

if (process.argv.length > 2) {
    var l = new Linker({
        maxDepth: 1,
        processor: new MenuProcessor()
    });

    var userArgs = process.argv.slice(2);

    l.crawl(userArgs[0])
    .progressed(function(result) {
        console.log('Progress: ', JSON.stringify(result, undefined, 2));
    })
    .finally(function(res) {
        //console.log('Results', JSON.stringify(l.menu, undefined, 2));
        console.log('Results count', l.results.length);
    });

} else {
    console.log('Invalid args');
}
