'use strict';

var xtend = require('xtend'),
    helpers = require('../helpers'),
    _ = require('underscore');

var InfoProcessor = function(options) {

    this.defaults = {
        infoSelectors: ['p:not(:has(div, p, select, textarea, input))', 'div:not(:has(div, ul, p, select, textarea, input))'],
        infoPages: ['history', 'story', 'about', 'info'],
        numberInfos: 5,
        infoWords: [],
        infoMinLength: 200
    };

    this.defaults = xtend(this.defaults, options);

    this.process = function($, website, results, promise) {
        var infos = _.where(results, {type: 'info'});
        var defaults = this.defaults;

        if (infos.length <  defaults.numberInfos) {
            var infoPage = (website.depth == 1) || new RegExp(defaults.infoPages.join("|")).exec(website.href.toLowerCase());
            if (!!infoPage) {
                _.each(defaults.infoSelectors, function(selector) {
                    var selecteds = $(selector);
                    _.each(selecteds, function(selected) {
                        var text = helpers.stripText($(selected).text())
                        var infoMatch = new RegExp(defaults.infoWords.join("|")).exec(text.toLowerCase());
                        if (infoMatch && text.length > defaults.infoMinLength) {
                            var result = {
                                type: 'info',
                                text: text,
                                html: $(selected).html(),
                                url: website.href
                            };
                            results.push(result);
                            promise.progress(result);
                        }
                    });
                });
            }
        }
    }
}

module.exports = InfoProcessor;
