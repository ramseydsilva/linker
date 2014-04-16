'use strict';

var _ = require('underscore');

var getMenu = function($, website) {
    var that = this;

    var getItemText = function(element, maxLength) {
        if (!maxLength) maxLength = that.defaults.menuItemMaxlength;
        try {
            if (!$(element).hasClass('addedToMenu')) {
                // if not already added before
                //var text = $($(element).html().replace(/>/g, '> ')).text().trim();
                var text = $(element).text().trim();
                if (text.length <= maxLength) {
                    var match = new RegExp(that.defaults.menuKeywords.join("|")).exec(text.toLowerCase());
                    var matchBlacklisted = new RegExp(that.defaults.menuKeywordsBlacklisted.join("|")).exec(text.toLowerCase());
                    if (!!match && !matchBlacklisted) {
                        $(element).addClass('addedToMenu'); // Mark as added
                        return that.stripText(text);
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
        return {name: that.stripText(text), class: _class, id: id, tag: tag, url: website.href };
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
            if (getParent && getItemText($(element).parent(), that.defaults.menuItemMaxlength + 200)) {
                // if parent is within the prescribed limit
                return getItem($(element).parent(), false);
            }
        }

        // finally process element
        if (!processBreaks(element)) {
            var text = getItemText(element);
            if (text) {
                var result = {item: constructResult(element, text)};

                // IF has children, add the children info
                if(!!$(element).children) {
                    result.item.children = [];
                    _.each($(element).children(), function(childElement) {
                        var childText = $(childElement).text();
                        if (childText) {
                            result.item.children.push(constructResult(childElement, childText));
                        }
                    });
                }

                if (that.menuIndex.indexOf(result.item.name) == -1) {
                    that.menu.push(result);
                    that.menuIndex.push(result.item.name);
                    that.promise.progress(result);
                }
            }
        }
    }

    _.each(this.defaults.menuSelectors, function(selector) {
        var selecteds = $(selector);
        _.each(selecteds, function(selected) {
            getItem(selected);
        });
    });
}

module.exports = getMenu;
