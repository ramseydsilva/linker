#! /usr/bin/env node

'use strict';

var Linker = require('../lib');

if (process.argv.length > 2) {
    var l = new Linker();
    var userArgs = process.argv.slice(2);

    l.crawl(userArgs[0])
    .progressed(function(res) {
        console.log('Progress: ', JSON.stringify(res, undefined, 2));
    })
    .finally(function(res) {
        console.log('Results', JSON.stringify(l.results, undefined, 2));
    });

} else {
    console.log('Invalid args');
}
