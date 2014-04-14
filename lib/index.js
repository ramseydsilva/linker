#! /usr/bin/env node

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
        getMenu: true,
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
    if (this.defaults.getMenu) {
        var selectors = ['p', 'span'];
        _.each(selectors, function(selector) {
            var selecteds = $(selector);
            _.each(selecteds, function(selected) {
                var text = $(selected).text();
                if (text.length <= that.defaults.menuItemMaxlength && text.indexOf('\n') == -1 && text.indexOf('\r') == -1) {
                    var match = new RegExp(that.defaults.menuKeywords.join("|")).exec(text.toLowerCase());
                    var matchBlacklisted = new RegExp(that.defaults.menuKeywordsBlacklisted.join("|")).exec(text.toLowerCase());
                    if (!!match && !matchBlacklisted) {
                        var result = {item: text};
                        if (!_.findWhere(that.menu, result)) {
                            that.menu.push(result);
                            that.promise.progress(result);
                        }
                    }
                }
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

    var match = new RegExp(this.defaults.links.join("|")).exec(link.href);
    var matchBlacklisted = new RegExp(this.defaults.blacklisted.join("|")).exec(link.href);
    if (!!match && !matchBlacklisted) {
        var result = {source: match[0], href: link.href};
        if (!_.findWhere(this.results, result)) {
            this.results.push(result);
            this.promise.progress(result);
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
    module.exports = Linker;
}
