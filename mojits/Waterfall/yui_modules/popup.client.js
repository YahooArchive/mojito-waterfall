/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*global YUI */

YUI.add('mojito-waterfall-popup', function (Y, NAME) {
    'use strict';

    function Popup(container, selector, updateFn, moveFn, className) {
        var popupNode = Y.Node.create('<div/>').addClass('popup').addClass(className).hide(),
            self = this;

        self.node = popupNode;
        self.container = container;
        self.updateFn = updateFn;
        self.moveFn = moveFn;

        container.on('mousedown', function () {
            self.hide();
        });

        container.all(selector).each(function (node, i) {
            node.on('mouseover', function (e) {
                if (!e.button) {
                    self.show();
                    self.update(e, i);
                    self.move(e, i);
                }
            });
            node.on('mouseup', function () {
                self.show();
            });
            node.on('mousemove', function (e) {
                self.move(e, i);
            });
            node.on('mouseout', function () {
                self.hide();
            });
        });

        container.append(popupNode, 'after');
    }

    Popup.prototype = {
        show: function () {
            this.node.show();
        },

        hide: function () {
            this.node.hide();
        },

        update: function (e, i) {
            this.updateFn(e, i);
        },

        move: function (e, i) {
            if (this.moveFn) {
                this.moveFn(e, i);
            }

            var container = this.container,
                mouseX = e.pageX,
                mouseY = e.pageY,
                topLimit = window.scrollY,
                leftLimit = container.getX(),
                rightLimit = container.get("offsetWidth") + container.getX(),
                bottomLimit = container.get("offsetHeight") + container.getY(),
                popupWidth = this.node.get("offsetWidth"),
                popupHeight = this.node.get("offsetHeight"),
                spacing = 10;

            this.node.setXY([
                Math.min(mouseX + spacing, Math.max(leftLimit, rightLimit - popupWidth)),
                Math.max(Math.min(mouseY + spacing, bottomLimit - popupHeight), topLimit)
            ]);
        }
    };

    Y.namespace('mojito.Waterfall').Popup = Popup;
}, '0.1.0', {
    requires: [
        'node'
    ]
});
