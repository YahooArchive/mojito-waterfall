/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen: true */
/*global YUI */

YUI.add('mojito-waterfall-action-context', function (Y, NAME) {
    'use strict';

    function WaterfallActionContext(opts, waterfall, id) {
        var action = opts.command.action || opts.command.instance.action || 'index';

        this.waterfall = waterfall;
        this._id = id;

        // Fake the controller with a noop such that we can call controller
        // ourselves in the waterfall dispatcher, otherwise the controller
        // would get called during the creation of the action context.
        opts.controller = {};
        opts.controller[action] = function () {};

        // Create action context.
        WaterfallActionContext.superclass.constructor.call(this, opts);
    }

    Y.extend(WaterfallActionContext, Y.mojito.ActionContext, {

        done: function (data, meta, more) {
            if (!more) {
                // Once the controller has called ac.done the controller
                // is considered finished and the rendering begins.
                this.waterfall.end('/' + this._id + '/Controller');
                this.waterfall.start('/' + this._id + '/Render', { level: 'mojito' });
            }

            WaterfallActionContext.superclass.done.apply(this, arguments);
        },

        error: function () {
            // The controller is considered finished once ac.error is called.
            this.waterfall.end('/' + this.name + '/Controller');
            WaterfallActionContext.superclass.error.apply(this, arguments);
        }
    });

    Y.namespace('mojito.Waterfall').ActionContext = WaterfallActionContext;


}, '0.1.0', {
    requires: [
        'oop',
        'mojito-action-context'
    ]
});
