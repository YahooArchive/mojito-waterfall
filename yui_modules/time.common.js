/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint regexp: true */
/*global YUI */

YUI.add('mojito-waterfall-time', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.Waterfall').Time = {

        timeScale: [
            'ps',
            'ns',
            'us',
            'ms',
            's',
            'h'
        ],

        timeToString: function (time, sigFigures) {
            return this.msTimeToString(this.convertTime(time, 'ms'), sigFigures);
        },

        msTimeToString: function (time, sigFigures) {
            var units = 'ms',
                decimals = 0;

            if (time === 0) {
                return '0';
            }

            if (Math.abs(time) >= 1000 * 60 * 60) {
                time /= (1000 * 60 * 60);
                units = 'h';
            } else if (Math.abs(time) >= 1000 * 60) {
                time /= (1000 * 60);
                units = 'min';
            } else if (Math.abs(time) >= 1000) {
                time /= 1000;
                units = 's';
            } else if (Math.abs(time) < Math.pow(10, -6)) {
                time *= Math.pow(10, 9);
                units = 'ps';
            } else if (Math.abs(time) < Math.pow(10, -3)) {
                time *= Math.pow(10, 6);
                units = 'ns';
            } else if (Math.abs(time) < 1) {
                time *= 1000;
                units = '\xB5s';
            }

            // count how many digits in front of decimal and determine how many decimal places
            // to show based on sigFigures
            sigFigures = Math.min(sigFigures || Number.MAX_VALUE, String(time).length);
            decimals = Math.max(sigFigures - (/./.test(String(time)) ? String(time).indexOf('.') : String(time).length), 0);

            return Math.round(time * Math.pow(10, decimals)) / Math.pow(10, decimals) + units;
        },

        timeToMs: function (time) {
            var timeStr = String(time).replace(/[,\s]/g, '').toLowerCase(),
                m = timeStr.match(/^(-?\d+(?:\.\d+)?)([^\d\.]*)?$/),
                units;

            time = m ? Number(m[1]) : NaN;
            units = m ? m[2] || 'ms' : 'ms';

            if (!time) {
                return 0;//NaN;
            }

            if (/^(ps|picoseconds?)$/.test(units)) {
                time *= Math.pow(10, -9);
            } else if (/^(ns|nanoseconds?)$/.test(units)) {
                time *= Math.pow(10, -6);
            } else if (/^(\xB5s|us|microseconds?)$/.test(units)) {
                time *= Math.pow(10, -3);
            } else if (/^(s|sec|seconds?)$/.test(units)) {
                time *= Math.pow(10, 3);
            } else if (/^(min|minutes?)$/.test(units)) {
                time *= Math.pow(10, 3) * 60;
            } else if (/^(h|hours?)$/.test(units)) {
                time *= Math.pow(10, 3) * 60 * 60;
            } else if (!/^(ms|miliseconds?)$/.test(units)) {
                time = 0;//NaN;
            }

            return time;
        },

        timeAndUnits: function (time) {
            var timeStr = String(time).replace(/[,\s]/g, '').toLowerCase(),
                m = timeStr.match(/^(-?\d+(?:\.\d+)?)([^\d\.]*)?$/);

            return {
                time: m ? Number(m[1]) : NaN,
                units:  m ? m[2] || 'ms' : 'ms'
            };
        },

        convertTime: function (time, units) {
            var timeAndUnits = this.timeAndUnits(time),
                convertedTime = timeAndUnits.time,
                i,
                factor,
                currentUnitIndex = this.timeScale.indexOf(timeAndUnits.units),
                targetUnitIndex = this.timeScale.indexOf(units || 'ms'),
                scaleUp = targetUnitIndex > currentUnitIndex;

            if (currentUnitIndex === -1 || targetUnitIndex === -1) {
                return NaN;
            }

            for (i = currentUnitIndex; i !== targetUnitIndex; i += scaleUp ? 1 : -1) {
                factor = i < 4 ? 1000 : 60;
                convertedTime = scaleUp ? convertedTime / factor : convertedTime * factor;
            }
            return convertedTime;
        }
    };

});