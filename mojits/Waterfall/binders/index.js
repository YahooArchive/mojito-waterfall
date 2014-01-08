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
            this.waterfall = this.mojitProxy.data.get('waterfall');
        },

        bind: function (node) {
            try {
                node.set('innerHTML', '');
                node.append(new Y.mojito.Waterfall.GUI(this.waterfall));
            } catch (e) {
                node.append('<span class="exception error" title="' + e.stack + '">Error: ' + e.message + '</span>');
                Y.log(e, 'error', NAME);
            }
        }
    };
}, '0.0.1', {
    requires: [
        'mojito-waterfall-gui'
    ]
});
