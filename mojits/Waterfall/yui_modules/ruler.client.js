/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen: true */
/*global YUI */

YUI.add('mojito-waterfall-ruler', function (Y, NAME) {
    'use strict';

    function Ruler(tbody, timeLineDuration, units) {
        var self = this,
            ruler = Y.Node.create('<div/>').addClass('waterfall-ruler no-select').hide(),
            length = Y.Node.create('<div/>').addClass('light length no-select'),
            timelineColumn = tbody.one('> tr > td.timeline .timeline-length'),
            timelineColumnWidth;

        ruler.append(Y.Node.create('<div/>').addClass('top lines no-select'));
        ruler.append(Y.Node.create('<div/>').addClass('bottom lines no-select'));
        ruler.append(length);

        tbody.on('mousedown', function (e) {
            if (e.button === 1) {
                timelineColumnWidth = timelineColumn.get('offsetWidth');
                self.start(e.pageX, e.pageY);
            }
        });

        tbody.on('mousemove', function (e) {
            if (self.isEnabled()) {
                self.update(e.pageX, e.pageY, timelineColumnWidth, timeLineDuration);
            }
        });

        tbody.on('mouseup', function (event) {
            self.end();
        });

        this._length = length;
        this._isEnabled = false;

        this.node = ruler;
        this.units = units;

        return ruler;
    }

    Ruler.prototype = {

        isEnabled: function () {
            return this._isEnabled;
        },

        start: function (mouseX, mouseY) {
            this.startX = mouseX;
            this.startY = mouseY;
            this._isEnabled = true;
        },

        update: function (mouseX, mouseY, timeLineWidthPx, timeLineDuration) {

            var time;
            // move ruler and set width/height
            if (!this._isEnabled) {
                return;
            }

            this.node.show();

            this.node.setStyle('left', Math.min(this.startX, mouseX))
                     .setStyle('top', Math.min(this.startY, mouseY))
                     .setStyle('width', Math.abs(this.startX - mouseX))
                     .setStyle('height', Math.abs(this.startY - mouseY));

            // update time length
            time = (Math.abs(this.startX - mouseX) / timeLineWidthPx) * timeLineDuration;
            this._length.set('text', Y.mojito.Waterfall.Time.timeToString(time + this.units, 3));
        },

        end: function () {
            this._isEnabled = false;
            this.node.hide();
        }
    };

    Y.namespace('mojito.Waterfall').Ruler = Ruler;
}, '0.0.1', {
    requires: [
        'node'
    ]
});
