'use strict';

var Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    _ = require('underscore'),
    async = require('async'),
    xtend = require('xtend'),
    fs = require('fs'),
    jsdom = require('jsdom'),
    jquery = require('fs').readFileSync("node_modules/jquery/dist/jquery.min.js", "utf-8");

Promise.longStackTraces();

var Linker = function(options) {
    this.defaults = {
        links: ['facebook', 'plus.google', 'yelp', 'yellowpages', 'openrice', 'twitter', 'foursquare', 'linkedin'],
        unallowed: ['javascript', 'mailto', '.pdf', '.jpeg', '.jpg', '.bmp', '.gif'],
        allowedDomains: [],
        selectors: [],
        menuKeywords: ['raspberry', 'mousse', 'parmesan', 'salad', 'chicken', 'eggs', 'garlic', 'pork', 'pig', 'peanut', 'salmon'],
        menuKeywordsBlacklisted: ['tasty', 'try', 'discover', 'to ', 'find', 'taste', 'when ', 'you ', 'many ', 'have ', 'is ', 'are ', 'it ',
            'before', 'change', 'price', 'we ', 'then '],
        menuSelectors: ['p', 'span'],
        getMenu: false,
        getLinks: true,
        menuItemMaxlength: 150,
        sameDomain: true,
        blacklisted: ['twitterapi', 'share', 'api', 'about', '/home'],
        maxLinks: 100,
        maxDepth: 3,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
            'Content-Type' : 'application/x-www-form-urlencoded' 
        }
    };
    this.defaults = xtend(this.defaults, options);

}

Linker.prototype.getAbsoluteUrl = function(absoluteUrl, relativeUrl) {
    var protocol = 'http', domain = '', link = '';
    // get protocol
    if (!!relativeUrl) {
        if (relativeUrl.indexOf('://') != -1) { // Url is already absolute
            return relativeUrl;
        } else if (relativeUrl.indexOf('/') == 0) { // Url starts with /
            domain = absoluteUrl.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[4];
            protocol = absoluteUrl.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
            return protocol+'://'+domain+relativeUrl;
        } else if (relativeUrl.indexOf('/') != -1 && relativeUrl.indexOf('.') != -1 
                    && relativeUrl.indexOf('.') < relativeUrl.indexOf('/')) { // Url has domain in it
            protocol = absoluteUrl.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
            return protocol+'://'+relativeUrl
        } else { // Url is truly relative
            return absoluteUrl.replace(/\/$/g, '') + '/' + relativeUrl;
        }
    }
    return false;
};

Linker.prototype.setAllowedDomains = function(website) {
    if (this.defaults.sameDomain) {
        var domain = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[4];
        var protocol = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
        this.defaults.allowedDomains.push('^'+protocol+'://([a-z0-9]*\\.)?'+domain);
    }
}

Linker.prototype.getSelectors = function($) {
    _.each(this.defaults.selectors, function(selector) {
        var selecteds = $(selector);
        _.each(selecteds, function(selected) {
            var selectorData = {};
            selectorData[selector] = {};
            selectorData[selector].text = $(selected).text();
            selectorData[selector].html = $(selected).html();
            this.promise.progress({selector: selectorData});
        });
    });
}

Linker.prototype.getMenu = function($) {
    var that = this;

    var stripText = function(text) {
        return text.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');
    }

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
                        return stripText(text);
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
        return {name: stripText(text), class: _class, id: id, tag: tag };
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

    if (this.defaults.getMenu) {
        _.each(this.defaults.menuSelectors, function(selector) {
            var selecteds = $(selector);
            _.each(selecteds, function(selected) {
                getItem(selected);
            });
        });
    }
}

Linker.prototype.processResponse = function(res) {
    var that = this;
    var promise = Promise.defer();

    jsdom.env({
        html: res[0].body,
        src: [jquery],
        done: function (err, window) {
            if (err) {
                that.website.reason = err;
                promise.reject(err);
            } else {
                var $ = window.$;

                //that.getSelectors($);
                that.getMenu($);

                var pageLinks = $('a');

                if (pageLinks.length > that.defaults.maxLinks) {
                    that.website.reason = "Too many links on page, not proceeding: " + pageLinks.length;
                    promise.resolve([]);
                } else {
                    var links = _.each(pageLinks, function(pageLink) {
                        if (!!$(pageLink).attr('href')) {
                            var href = that.getAbsoluteUrl(that.website.href, $(pageLink).attr('href'));
                            if (!!href) {
                                var link = {
                                    depth: that.website.depth+1,
                                    text: $(pageLink).text(),
                                    href: that.getAbsoluteUrl(that.website.href, $(pageLink).attr('href')),
                                    links: [],
                                    crawled: false
                                };
                                that.website.links.push(link);
                            }
                        }
                    });
                    promise.resolve(that.website.links);
                }
            }
        }
    })
    return promise.promise;
}

Linker.prototype.processLink = function(link) {
    var promise = Promise.defer();
    promise.promise.cancellable();

    if (this.defaults.getLinks) {
        var match = new RegExp(this.defaults.links.join("|")).exec(link.href);
        var matchBlacklisted = new RegExp(this.defaults.blacklisted.join("|")).exec(link.href);
        if (!!match && !matchBlacklisted) {
            var result = {source: match[0], href: link.href};
            if (!_.findWhere(this.results, result)) {
                this.results.push(result);
                this.promise.progress(result);
            }
        }
    }

    if (link.depth > this.defaults.maxDepth) {
        link.reason = 'Max depth reached';
        promise.resolve();
    } else if (link.href.indexOf('http') != 0) {
        link.reason = 'Url is not absolute';
        promise.resolve();
    } else if (!new RegExp(this.defaults.allowedDomains.join("|")).test(link.href)) {
        link.reason = 'Url is not in list of allowed domains';
        promise.resolve();
    } else if (new RegExp(this.defaults.unallowed.join("|")).test(link.href)) {
        link.reason = 'UnAllowed extension';
        promise.resolve();
    } else if (this.crawledLinks.indexOf(link.href) != -1) {
        link.reason = 'Url already crawled';
        promise.resolve();
    } else {
        promise.resolve(this._crawl(link));
    }

    return promise.promise;
}

Linker.prototype._crawl = function(website) {
    var promise = Promise.defer();

    this.website = website;
    this.website.crawled = true;
    this.crawledLinks.push(website.href);
    request({
        url: website.href,
        headers: this.defaults.headers
    }).bind(this)
        .then(this.processResponse).bind(this)
        .map(this.processLink)
        .then(function(res) {
            promise.resolve();
        })
        .catch(function(err) {
            console.log('Crawl Error: ', err);
            promise.resolve();
        });

    return promise.promise;
}

Linker.prototype.crawl = function(website) {
    this.allLinks = {};
    this.crawledLinks = [];
    this.results = [];
    this.menu = [];
    this.menuIndex = [];
    this.promise = Promise.defer();
    this.promise.promise.cancellable();

    if (typeof website == 'string') {
        // First iteration do setup
        website = { depth: 1, text: 'main', href: website, links: [], crawled: false};
        this.allLinks = website;
        this.setAllowedDomains(website);
    }

    // Start crawl
    var that = this;
    this._crawl(website)
    .then(function(res) {
        that.promise.resolve();
    })
    .catch(function(err) {
        console.log('Main Error: ', err);
        that.promise.resolve();
    });

    return this.promise.promise;
}

module.exports = Linker;
