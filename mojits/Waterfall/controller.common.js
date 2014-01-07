/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*global YUI */

YUI.add('mojito-waterfall-controller', function (Y, NAME) {
    'use strict';

    Y.mojito.controllers[NAME] = {

        index: function (ac) {
            var data = ac.params.body('waterfall');

            ac.data.set('waterfall', data);

            ac.assets.addCss('./css/sorter.css');
            ac.assets.addCss('./css/waterfall_popup.css');
            ac.assets.addCss('./css/waterfall_summary_popup.css');
            ac.assets.addCss('./css/waterfall_ruler.css');
            ac.assets.addCss('./css/waterfall_table.css');

            ac.done();
        }
    };

}, '0.0.1', {
    requires: [
        'mojito-data-addon',
        'mojito-params-addon',
        'mojito-assets-addon'
    ]
});
