#! /usr/bin/env node

'use strict';

var Linker = require('../lib');

if (process.argv.length > 2) {
    var userArgs = process.argv.slice(2);
    var l = new Linker({
        getLinks: false,
        getInfo: true,
        maxDepth: 3,
        infoWords: [userArgs[1]]
    });

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
