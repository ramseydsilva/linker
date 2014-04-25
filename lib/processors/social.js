'use strict';

var xtend = require('xtend'),
    _ = require('underscore');

var SocialProcessor = function(options) {

    this.defaults = {
        links: ['facebook', 'plus.google', 'yelp', 'yellowpages', 'openrice', 'twitter', 'foursquare', 'linkedin'],
        blacklisted: ['twitterapi', 'share', 'api', 'about', '/home']
    };

    this.defaults = xtend(this.defaults, options);

    this.processLinks = function(link, results, promise) {
        var match = new RegExp(this.defaults.links.join("|")).exec(link.href);
        var matchBlacklisted = new RegExp(this.defaults.blacklisted.join("|")).exec(link.href);
        if (!!match && !matchBlacklisted) {
            var result = {type: 'link', result: { source: match[0], href: link.href}};
            if (!_.findWhere(results, {type: 'link', result: { href: result.href }})) {
                results.push(result);
                promise.progress(result);
            }
        }
    }
}

module.exports = SocialProcessor;
