#! /usr/bin/env node

'use strict';

var Linker = require('../lib'),
    SocialProcessor = require('../lib/processors/social');

if (process.argv.length > 2) {
    var l = new Linker({
        processor: new SocialProcessor()
    });
    var userArgs = process.argv.slice(2);

    l.crawl(userArgs[0])
    .progressed(function(res) {
        console.log('Progress: ', JSON.stringify(res, undefined, 2));
    })
    .finally(function(res) {
        console.log(l.links);
        console.log('Results', JSON.stringify(l.results, undefined, 2));
    });

} else {
    console.log('Invalid args');
}
