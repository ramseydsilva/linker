'use strict';

var helpers = {};

helpers.getAbsoluteUrl = function(absoluteUrl, relativeUrl) {
    var protocol = 'http', domain = '', link = '';

    if (!!relativeUrl) {
        if (relativeUrl.indexOf('://') != -1) { // Url is already absolute
            return relativeUrl;
        } else if (relativeUrl.indexOf('#') > relativeUrl.indexOf('/')) { // This is a tag, so return the root url
            return helpers.getAbsoluteUrl(absoluteUrl, relativeUrl.slice(0, relativeUrl.lastIndexOf('#')));
        } else if (relativeUrl.indexOf('/') != -1 && relativeUrl.indexOf('.') != -1 
                    && relativeUrl.indexOf('.') < relativeUrl.indexOf('/')) { // Url has domain in it
            protocol = absoluteUrl.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2];
            return protocol+'://'+relativeUrl
        } else { // Url is truly relative
            protocol = absoluteUrl.split(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?()?/)[2] + '://';
            var to_return = absoluteUrl.replace(protocol, '').replace(/\/[a-zA-Z0-9.?=-_]+$/g, '') + '/' + relativeUrl;
            to_return = to_return.replace(/\/\//g, '/');
            return protocol + to_return;
        }
    }
    return false;
};

helpers.stripText = function(text) {
    return text.replace(/\r/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ').replace(/\s{2,}/g, ' ');
}

module.exports = helpers;
