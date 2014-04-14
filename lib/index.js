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
        sameDomain: true,
        blacklisted: ['twitterapi'],
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

                _.each(that.defaults.selectors, function(selector) {
                    var s = $(selector);
                    var selectorData = {};
                    selectorData[selector] = s.text();
                    that.promise.progress({selector: selectorData});
                });

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
        console.log('Progress: ', res);
    })
    .finally(function(res) {
        console.log('Results', JSON.stringify(l.results, undefined, 2));
    });

} else {
    module.exports = Linker;
}
