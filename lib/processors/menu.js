'use strict';

var xtend = require('xtend'),
    helpers = require('../helpers'),
    _ = require('underscore');

var MenuProcessor = function(options) {
    this.defaults = {
        menuIndex: [],
        menuItemMaxlength: 150,
        menuKeywords: ['raspberry', 'mousse', 'parmesan', 'salad', 'chicken', 'egg', 'garlic', 'pork', 'pig', 'peanut', 'salmon', 'noodles',
            'curry', 'shrimp', 'coconut', 'soup', 'suey', 'tofu', 'mango', 'ice cream', 'squid', 'seafood', 'mussels', 'fish', 'cheese', 'potato', 'truffle',
            'marrow', 'duck', 'bbq', 'frite', 'tomato', 'parmesan', 'oatmeal', 'stout', 'beer', 'chives', 'arugula', 'onion', 'lemon', 'cream', 'spicy', 'coleslaw'],
        menuKeywordsBlacklisted: ['\\btry\\b', '\\bdiscover\\b', '\\bto\\b', '\\bfind\\b', '\\btaste\\b', '\\bwhen\\b', '\\byou\\b',
            '\\bmany\\b', '\\bhave\\b', '\\bis\\b', '\\bare\\b', '\\bit\\b',
            '\\bbefore\\b', '\\bchange\\b', '\\bprice\\b', '\\bwe\\b', '\\bthen\\b'],
        menuSelectors: ['p', 'span', '.menu', '.item', '#menu', '#item', '#menu-item', 'div']
    };

    if (options) this.defaults = xtend(this.defaults, options);

    this.process = function($, website, results, promise) {

        var defaults = this.defaults;

        var getItemText = function(element, maxLength) {
            if (!maxLength) maxLength = defaults.menuItemMaxlength;
            try {
                if (!$(element).hasClass('addedToMenu')) {
                    // if not already added before
                    //var text = $($(element).html().replace(/>/g, '> ')).text().trim();
                    var text = $(element).text().trim();
                    if (text.length <= maxLength) {
                        var match = new RegExp(defaults.menuKeywords.join("|")).exec(text.toLowerCase());
                        var matchBlacklisted = new RegExp(defaults.menuKeywordsBlacklisted.join("|")).exec(text.toLowerCase());
                        if (!!match && !matchBlacklisted) {
                            $(element).addClass('addedToMenu'); // Mark as added
                            return helpers.stripText(text);
                        }
                    }
                }
            } catch (err) {
                if (err.name.indexOf("Syntax error") == -1) console.log(err.name, err.message);
            };
            return false;
        }

        var constructResult = function(element, text) {
            var id = '', _class = '';
            try { _class = $(element).attr('class').replace('addedToMenu', ''); } catch(e) {};
            try { id = $(element).attr('id'); } catch(e) {};
            var tag = element.tagName;
            return {name: helpers.stripText(text), class: _class, id: id, tag: tag, url: website.href };
        }

        var processBreaks = function(element) {
            // If the element has br tags, then need to split it up into own element
            var breaks = [];
            if ($(element).html().indexOf('<br>') != -1) {
                breaks = $(element).html().split('<br>');
            }
            if ($(element).html().indexOf('<br/>') != -1) {
                breaks = $(element).html().split('<br/>');
            }
            if ($(element).html().indexOf('<br />') != -1) {
                breaks = $(element).html().split('<br />');
            }
            if (breaks.length > 1) {
                _.each(breaks, function(_break) {
                    getItem($('<div>'+_break+'</div>'), false);
                });
            }
            return false
        }

        var getItem = function(element, getParent) {
            if (!getParent) getParent = true;
            if (!!element && element.hasChildNodes) {
                // Check if has children
                if (getParent && getItemText($(element).parent(), defaults.menuItemMaxlength + 200)) {
                    // if parent is within the prescribed limit
                    return getItem($(element).parent(), false);
                }
            }

            // finally process element
            if (!processBreaks(element)) {
                var text = getItemText(element);
                if (text) {
                    var result = {type: 'menu', result: constructResult(element, text)};

                    // IF has children, add the children info
                    if(!!$(element).children) {
                        result.result.children = [];
                        _.each($(element).children(), function(childElement) {
                            var childText = $(childElement).text();
                            if (childText) {
                                result.result.children.push(constructResult(childElement, childText));
                            }
                        });
                    }

                    if (defaults.menuIndex.indexOf(result.result.name) == -1) {
                        results.push(result);
                        defaults.menuIndex.push(result.result.name);
                        promise.progress(result);
                    }
                }
            }
        }

        _.each(defaults.menuSelectors, function(selector) {
            var selecteds = $(selector);
            _.each(selecteds, function(selected) {
                getItem(selected);
            });
        });
    }
}

module.exports = MenuProcessor;
