/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen: true, indent: 4 */
/*global YUI */

YUI.add('mojito-waterfall-binder-index', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.binders')[NAME] = {

        init: function (mojitProxy) {
            this.mojitProxy = mojitProxy;
        },

        bind: function (node) {
            try {
                var waterfall = new Y.mojito.Waterfall.GUI(this.mojitProxy.data.get('waterfall'));
                node.append(waterfall.get());
            } catch (e) {
                node.append('<span class="error">Error: ' + e.message + '</span>');
            }
        }
    };
}, '0.0.1', {
    requires: [
        'mojito-waterfall-gui'
    ]
});
