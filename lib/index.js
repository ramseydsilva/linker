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
        sameDomain: true,
        maxLinks: 15,
        maxDepth: 3,
        allowedDomains: [],
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
            'Content-Type' : 'application/x-www-form-urlencoded' 
        },
        processor: {
            process: function($, website, results, promise) {
                // process the page html, can optionally resolve the promise at this stage or let it proceed
            },
            processLinks: function(link, results, promise) {
                // Process the links on page, can optionally resolve the promise at this stage or let it proceed
            }
        }
    };

    this.defaults = xtend(this.defaults, options);

    this.links = {};
    this.crawledLinks = this.defaults.crawledLinks;
    this.processor = this.defaults.processor;
    this.results = [];
    this.promise = Promise.defer();

    this.processResponse = function(args) {
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

                    // Process the response using the processor, processor can choose to resolve at this stage if they want
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
                                    crawled: false
                                };
                                website.links.push(link);
                            }
                        }
                    });

                    // Collect all the links and push them to be processed
                    promise.resolve(website.links);
                }
            }
        })

        return promise.promise;
    }

    this.processLink = function(link) {
        var promise = Promise.defer();

        // let user process the links on the page, they can choose to prematurely resolve it if they want to
        if (this.processor && this.processor.processLinks)
            this.processor.processLinks(link, this.results, this.promise);

        if (this.crawledLinks.length > this.defaults.maxLinks) {
            link.reason = 'MaxLinks reached, not going to crawl further';
        } else if (link.depth > this.defaults.maxDepth) {
            link.reason = 'Max depth reached';
        } else if (link.href.indexOf('http') != 0) {
            link.reason = 'Url is not absolute';
        } else if (!new RegExp(this.defaults.allowedDomains.join("|")).test(link.href)) {
            link.reason = 'Url is not in list of allowed domains';
        } else if (new RegExp(this.defaults.unallowed.join("|")).test(link.href)) {
            link.reason = 'UnAllowed extension';
        } else if (this.crawledLinks.indexOf(link.href) != -1) {
            link.reason = 'Url already crawled';
        }

        if (link.reason) {
            promise.resolve();
        } else {
            promise.resolve(this._crawl(link));
        }

        return promise.promise;
    }

    this._crawl = function(website) {
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
            this.crawledLinks.push(website.href);
            this.promise.progress('Crawled: ' + website.href);

            if (res[0].statusCode == 200) {
                return Promise.resolve([res, website]);
            } else {
                return Promise.reject('Status code: ' + res[0].statusCode + ', Path: ' + res[0].request.path);
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

    this.crawl = function(website) {
        // Start crawl

        website = { depth: 1, text: 'main', href: website, links: [], crawled: false};
        this.links = website;

        // Set allowed domains
        if (this.defaults.sameDomain) {
            var domain = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[4];
            var protocol = website.href.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
            this.defaults.allowedDomains.push('^'+protocol+'://([a-z0-9]*\\.)?'+domain);
        }

        this._crawl(website);
        return this.promise.promise;
    }

}

module.exports = Crawler;
