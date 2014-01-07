/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*global YUI, unescape */

YUI.add('mojito-waterfall-gui', function (Y, NAME) {
    'use strict';

    function WaterfallGUI(data) {
        var container = Y.Node.create('<div/>').addClass('waterfall');

        // Append Waterfall table.
        container.append(new Y.mojito.Waterfall.Table(data));

        // Append Waterfall stats table.
        if (data.stats) {
            container.append('<br/>');
            container.append(new Y.mojito.Waterfall.StatsTable(data.stats));
        }

        return container;
    }

    Y.namespace('mojito.Waterfall').GUI = WaterfallGUI;

}, '0.0.1', {
    requires: [
        'node',
        'mojito-waterfall-table',
        'mojito-waterfall-stats-table'
    ]
});
