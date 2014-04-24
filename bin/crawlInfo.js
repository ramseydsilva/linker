#! /usr/bin/env node

'use strict';

var Linker = require('../lib'),
    InfoProcessor = require('../lib/processors/info');

if (process.argv.length > 2) {
    var userArgs = process.argv.slice(2);
    var l = new Linker({
        maxDepth: 15,
        maxLinks: 2000,
        processor: new InfoProcessor()
    });

    l.crawl(userArgs[0])
    .progressed(function(res) {
        console.log('Progress: ', JSON.stringify(res, undefined, 2));
    })
    .finally(function(res) {
        console.log('Results count', l.results.length);
        console.log('Total links', l.crawledLinks.length);
    });

} else {
    console.log('Invalid args');
}
