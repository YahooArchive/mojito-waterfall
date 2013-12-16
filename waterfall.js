/*jslint nomen: true */
var YUI = require('yui').YUI,
    path = require('path');

exports.Waterfall = YUI({
    useSync: true,
    modules: {
        'waterfall': {
            fullpath: path.join(__dirname, './yui_modules/waterfall.common.js')
        },
        'waterfall-time': {
            fullpath: path.join(__dirname, './yui_modules/waterfall-time.common.js')
        }
    }
}).use('waterfall').Waterfall;