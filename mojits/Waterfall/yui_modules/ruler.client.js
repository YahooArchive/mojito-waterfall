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
            ruler = Y.Node.create('<div/>').addClass('waterfall-ruler').hide(),
            length = Y.Node.create('<div/>').addClass('light length'),
            lastColumn = tbody.one('> tr > td:last-child');

        ruler.append(Y.Node.create('<div/>').addClass('top lines'));
        ruler.append(Y.Node.create('<div/>').addClass('bottom lines'));
        ruler.append(length);

        function mouseIsOverLastColumn(e) {
            return e.pageX >= lastColumn.getX() && e.pageX <= lastColumn.getX() + lastColumn.get('offsetWidth');
        }

        tbody.on('mousedown', function (e) {
            if (e.button === 1 && mouseIsOverLastColumn(e)) {
                self.start(e.pageX, e.pageY);
            }
        });

        tbody.on('mousemove', function (e) {
            if (!mouseIsOverLastColumn(e)) {
                self.end();
            } else if (self.isEnabled()) {
                self.update(e.pageX, e.pageY, lastColumn.get('offsetWidth') - lastColumn.getStyle('paddingRight').replace('px', ''), timeLineDuration);
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
            this._length.setStyle('marginLeft', -1 * this._length.getStyle('width').replace('px', '') / 2);
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
