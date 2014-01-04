/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*global YUI */

YUI.add('mojito-waterfall-popup', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.Waterfall').Popup = function (tbody, container, update, columns, className) {
        var popup = Y.Node.create('<div/>').addClass('popup').addClass(className).hide(),
            self = this,
            attachEvents = function (node, row, col) {
                node.on('mouseover', function (e) {
                    if (!e.button) {
                        self.show();
                        self.update(row, col);
                        self.move(e.pageX, e.pageY);
                    }
                });
                node.on('mouseup', function () {
                    self.show();
                });
                node.on('mousemove', function (e) {
                    self.move(e.pageX, e.pageY);
                });
                node.on('mouseout', function () {
                    self.hide();
                });
            };

        tbody.on('mousedown', function () {
            self.hide();
        });

        tbody.all('> tr').each(function (tr, row) {
            if (!columns) {
                attachEvents(tr, row);
                return;
            }
            tr.all('> td').each(function (td, col) {
                if (columns.indexOf(col) !== -1) {
                    attachEvents(td, row, col);
                }
            });
        });

        container.append(popup);

        this.show = function () {
            popup.show();
        };

        this.hide = function () {
            popup.hide();
        };

        this.update = function (row, col) {
            update(popup, row, col);
        };

        this.move = function (mouseX, mouseY) {
            var topLimit = window.scrollY,
                leftLimit = tbody.getX(),
                rightLimit = tbody.get("offsetWidth") + tbody.getX(),
                bottomLimit = tbody.get("offsetHeight") + tbody.getY(),
                popupWidth = popup.get("offsetWidth"),
                popupHeight = popup.get("offsetHeight"),
                spacing = 10;

            popup.setXY([
                Math.min(mouseX + spacing, Math.max(leftLimit, rightLimit - popupWidth)),
                Math.max(Math.min(mouseY + spacing, bottomLimit - popupHeight), topLimit)
            ]);
        };
    };
}, '0.1.0', {
    requires: [
        'node'
    ]
});
