/*jslint nomen: true, indent: 4 */
/*globals YUI */

YUI.add('waterfall-binder-index', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.binders')[NAME] = {

        init: function (mojitProxy) {
            this.mojitProxy = mojitProxy;
        },

        bind: function (node) {
            try {
                var waterfall = new Y.Waterfall.GUI(this.mojitProxy.data.get('waterfall'));
                Y.one('#' + this.mojitProxy._viewId).append(waterfall.get());
            } catch (e) {
                Y.one('#' + this.mojitProxy._viewId).append('<span class="error">Error: ' + e.message + '</span>');
            }
        }
    };
}, '0.0.1', {
    requires: [
        'transition',
        'waterfall-gui'
    ]
});
