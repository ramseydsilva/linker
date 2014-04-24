'use strict';

var Promise = require('bluebird'),
    request = Promise.promisify(require('request')),
    _ = require('underscore'),
    async = require('async'),
    xtend = require('xtend'),
    fs = require('fs'),
    jsdom = require('jsdom'),
    jquery = require('fs').readFileSync("node_modules/jquery/dist/jquery.min.js", "utf-8"),
    helpers = require('./helpers');

Promise.longStackTraces();

var Crawler = function(options) {
    this.defaults = {
        crawledLinks: [],
        unallowed: ['javascript', 'mailto', '.pdf', '.jpeg', '.jpg', '.bmp', '.gif', 'blog', 'franchise'],
        allowedDomains: [],
        sameDomain: true,
        maxLinks: 15,
        maxDepth: 3,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
            'Content-Type' : 'application/x-www-form-urlencoded' 
        }
    };
    this.defaults = xtend(this.defaults, options);

    this.allLinks = {};
    this.crawledLinks = this.defaults.crawledLinks || [];
    this.results = [];
    this.promise = Promise.defer();
    this.promise.promise.cancellable();
    this.startUrl = '';

    this.processor = {
        process: function($, website, results, promise) {},
        processLinks: function($, website, results, promise) {}
    }
}

Crawler.prototype.processResponse = function(args) {
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

                // let user process html data
                if (that.processor && that.processor.process)
                    that.processor.process($, website, that.results, that.promise);

                var pageLinks = $('a');
                var links = _.each(pageLinks, function(pageLink) {
                   if (!!$(pageLink).attr('href')) {
                        var href = helpers.getAbsoluteUrl(website.href, $(pageLink).attr('href'));
                        if (!!href) {
                            var link = {
                                depth: website.depth+1,
                                text: $(pageLink).text(),
                                href: href,
                                links: [],
                                crawled: false,
                                shouldCrawl: that.crawledLinks.indexOf(href) < 0 && that.crawledLinks.length < that.defaults.maxLinks
                            };

                            website.links.push(link);

                        }
                    }
                });
                promise.resolve(website.links);
            }
        }
    })
    return promise.promise;
}

Crawler.prototype.processLink = function(link) {
    var promise = Promise.defer();
    promise.promise.cancellable();

    // let user process the links on the page
    if (this.processor && this.processor.processLinks)
        this.processor.processLinks(link, this.results, this.promise);

    if (!link.shouldCrawl) {
        link.reason = 'Instructed not to crawl';
        promise.resolve();
    } else if (link.depth > this.defaults.maxDepth) {
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

Crawler.prototype._crawl = function(website) {
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
            this.promise.progress({url: website.href});
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

Crawler.prototype.crawl = function(website) {
    if (typeof website == 'string') {
        // First iteration do setup
        this.startUrl = website;
        website = { depth: 1, text: 'main', href: website, links: [], crawled: false};
        this.allLinks = website;

        // set allowed domains
        if (this.defaults.sameDomain) {
            var domain = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[4];
            var protocol = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
            this.defaults.allowedDomains.push('^'+protocol+'://([a-z0-9]*\\.)?'+domain);
        }
    }

    // Start crawl
    var that = this;
    this._crawl(website)
    .then(function(res) {
        that.promise.resolve();
    })
    .finally(function() {
        console.log('Finished!!!');
    })
    .catch(function(err) {
        console.log('Main Error: ', err);
        that.promise.resolve();
    });

    return this.promise.promise;
}

module.exports = Crawler;
