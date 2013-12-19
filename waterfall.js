/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen: true */

var YUI = require('yui').YUI,
    path = require('path');

exports.Waterfall = YUI({
    useSync: true,
    modules: {
        'mojito-waterfall': {
            fullpath: path.join(__dirname, './yui_modules/waterfall.common.js')
        },
        'mojito-waterfall-time': {
            fullpath: path.join(__dirname, './yui_modules/time.common.js')
        }
    }
}).use('waterfall').Waterfall;