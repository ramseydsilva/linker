'use strict';

var Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    _ = require('underscore'),
    async = require('async'),
    xtend = require('xtend'),
    getMenu = require('./menu'),
    fs = require('fs'),
    jsdom = require('jsdom'),
    jquery = require('fs').readFileSync("node_modules/jquery/dist/jquery.min.js", "utf-8");

Promise.longStackTraces();

var Linker = function(options) {
    this.defaults = {
        links: ['facebook', 'plus.google', 'yelp', 'yellowpages', 'openrice', 'twitter', 'foursquare', 'linkedin'],
        unallowed: ['javascript', 'mailto', '.pdf', '.jpeg', '.jpg', '.bmp', '.gif', 'blog', 'franchise'],
        allowedDomains: [],
        infoSelectors: ['p', 'div:not(:has(div, ul, p))'],
        infoPages: ['history', 'story', 'about', 'info'],
        numberInfos: 5,
        infoWords: [],
        infoMinLength: 200,
        menuKeywords: ['raspberry', 'mousse', 'parmesan', 'salad', 'chicken', 'egg', 'garlic', 'pork', 'pig', 'peanut', 'salmon', 'noodles',
            'curry', 'shrimp', 'coconut', 'soup', 'suey', 'tofu', 'mango', 'ice cream', 'squid', 'seafood', 'mussels', 'fish', 'cheese', 'potato', 'truffle',
            'marrow', 'duck', 'bbq', 'frite', 'tomato', 'parmesan', 'oatmeal', 'stout', 'beer', 'chives', 'arugula', 'onion', 'lemon', 'cream', 'spicy', 'coleslaw'],
        menuKeywordsBlacklisted: ['\\btry\\b', '\\bdiscover\\b', '\\bto\\b', '\\bfind\\b', '\\btaste\\b', '\\bwhen\\b', '\\byou\\b',
            '\\bmany\\b', '\\bhave\\b', '\\bis\\b', '\\bare\\b', '\\bit\\b',
            '\\bbefore\\b', '\\bchange\\b', '\\bprice\\b', '\\bwe\\b', '\\bthen\\b'],
        menuSelectors: ['p', 'span', '.menu', '.item', '#menu', '#item', '#menu-item', 'div'],
        getInfo: false,
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
            return absoluteUrl.replace(/\/(\w+)?(.)?(\w+)?$/g, '') + '/' + relativeUrl;
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

Linker.prototype.stripText = function(text) {
    return text.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');
}

Linker.prototype.getInfo = function(link, $) {
    var that = this;
    if (that.infos.length > that.defaults.numberInfos) {
        that.defaults.getInfo = false;
    } else {
        var infoPage = (link == this.startUrl) || new RegExp(this.defaults.infoPages.join("|")).exec(link.toLowerCase());
        if (!!infoPage) {
            _.each(this.defaults.infoSelectors, function(selector) {
                var selecteds = $(selector);
                _.each(selecteds, function(selected) {
                    var text = that.stripText($(selected).text())
                    var infoMatch = new RegExp(that.defaults.infoWords.join("|")).exec(text.toLowerCase());
                    if (infoMatch && text.length > that.defaults.infoMinLength) {
                        var info = {info: {
                            text: text,
                            html: $(selected).html(),
                            url: link
                        }};
                        that.infos.push(info);
                        that.promise.progress(info);
                    }
                });
            });
        }
    }
}

Linker.prototype.processResponse = function(args) {
    var res = args[0], website = args[1];
    var that = this;
    var promise = Promise.defer();

    jsdom.env({
        html: res[0].body,
        src: [jquery],
        done: function (err, window) {
            if (err) {
                website.reason = err;
                promise.reject(err);
            } else {
                var $ = window.$;

                if (that.defaults.getInfo) that.getInfo(website.href, $);
                if (that.defaults.getMenu) getMenu.call(that, $, website);

                var pageLinks = $('a');
                if (!that.defaults.getInfo && (pageLinks.length > that.defaults.maxLinks)) {
                    // if too many links on page
                    website.reason = "Too many links on page, not proceeding: " + pageLinks.length;
                    promise.resolve([]);
                } else {
                    var links = _.each(pageLinks, function(pageLink) {
                        if (!!$(pageLink).attr('href')) {
                            var href = that.getAbsoluteUrl(website.href, $(pageLink).attr('href'));
                            if (!!href) {
                                var link = {
                                    depth: website.depth+1,
                                    text: $(pageLink).text(),
                                    href: that.getAbsoluteUrl(website.href, $(pageLink).attr('href')),
                                    links: [],
                                    crawled: false
                                };
                                website.links.push(link);
                            }
                        }
                    });
                    promise.resolve(website.links);
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
    promise.promise.cancellable();

    var that = this;
    request({
        url: website.href,
        headers: this.defaults.headers
    }).bind(this)
    .then(function(res) {
        website.crawled = true;
        website.statusCode = res[0].statusCode;
        if (res[0].statusCode == 200) {
            this.crawledLinks.push(website.href);
            return Promise.resolve([res, website]);
        } else {
            return Promise.reject(res[0].request.path + ' ' + res[0].statusCode);
        }
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
    this.infos = [];
    this.menu = [];
    this.menuIndex = [];
    this.promise = Promise.defer();
    this.promise.promise.cancellable();
    this.startUrl = website;

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
    .finally(function() {
        //console.log(JSON.stringify(that.allLinks, undefined, 2))
    })
    .catch(function(err) {
        console.log('Main Error: ', err);
        that.promise.resolve();
    });

    return this.promise.promise;
}

module.exports = Linker;
