/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint nomen: true */
/*global YUI, YUITest */

YUI.add('waterfall-tests', function (Y, NAME) {
    'use strict';

    var Assert = YUITest.Assert,
        suite = new YUITest.TestSuite(NAME);

    suite.add(new YUITest.TestCase({

        name: 'Waterfall unit tests',

        verifyGUI: function (waterfallData) {
            // TODO: test waterfall-gui
            var body = Y.one('body'),
                waterfall = new Y.mojito.Waterfall.GUI(waterfallData),
                waterfallElement = waterfall.get();

            body.append(waterfallElement);
        },

        verifyProfile: function (expectedProfile, actualProfile) {
            var self = this;

            Assert.areEqual(expectedProfile.id, actualProfile.id, 'Mismatching profile ids.');

            // verify durations
            Assert.areEqual(Y.Object.size(expectedProfile.durations), Y.Object.size(actualProfile.durations), 'Unequal number of durations for \'' + expectedProfile.id + '\'');
            Y.Object.each(expectedProfile.durations, function (expectedDuration, id) {
                Assert.isNotUndefined(actualProfile.durations[id], 'Did not find expected duration type \'' + id + '\'');
            });

            // verify children
            Assert.areEqual(Y.Object.size(expectedProfile.children), Y.Object.size(actualProfile.children), 'Unequal number of children for \'' + expectedProfile.id + '\'');
            Y.Object.each(expectedProfile.children, function (expectedChildProfileArray, id) {
                var actualChildProfileArray = actualProfile.children[id];
                Assert.areEqual(expectedChildProfileArray.length, actualChildProfileArray.length, 'Mismatching number of profiles for profile of type \'' + id + '\'');
                Y.Array.each(expectedChildProfileArray, function (expectedChildProfile, index) {
                    var actualChildProfile = actualChildProfileArray[index];
                    self.verifyProfile(expectedChildProfile, actualChildProfile);
                });
            });
        },

        setUp: function () {
            Y.applyConfig({
                useSync: true,
                modules: {
                    'mojito-waterfall': {
                        fullpath: require('path').join(__dirname, '../yui_modules/waterfall.common.js')
                    },
                    'mojito-waterfall-gui': {
                        fullpath: require('path').join(__dirname, '../yui_modules/gui.client.js')
                    },
                    'mojito-waterfall-popup': {
                        fullpath: require('path').join(__dirname, '../yui_modules/popup.client.js')
                    }
                }
            });

            Y.use('mojito-waterfall');
        },

        'Test stop, resume, and clear': function () {
            var waterfall = new Y.mojito.Waterfall(),
                waterfallData;

            waterfall.resume();

            waterfall.pause();
            waterfall.pause();
            waterfall.start('a');
            waterfall.event('a');
            Assert.areSame(0, waterfall._calls.length, 'Unexpected number of calls.');

            waterfall.resume();
            waterfall.start('a');
            waterfall.event('a');
            waterfall.end('a');

            Assert.areSame(3, waterfall._calls.length, 'Unexpected number of calls.');

            waterfall.clear();
            Assert.areSame(0, waterfall._calls.length, 'Unexpected number of calls.');
        },

        'Invalid Waterfall': function () {
            var waterfall = new Y.mojito.Waterfall(),
                expectedRootProfile = {
                    id: 'root'
                };

            waterfall.start();
            waterfall.end();
            waterfall.start('a:b:c');
            waterfall.end('a:b:c');
            waterfall.start('/a/');
            waterfall.end('/a/');
            waterfall.start('/:a');
            waterfall.end('/:a');
            waterfall.start('/:/a');
            waterfall.end('/:/a');
            waterfall.start('/a:');
            waterfall.end('/a:');
            waterfall.start(':a/');
            waterfall.end(':a/');

            waterfall.end('a');
            waterfall.start('a');
            waterfall.start('b');

            waterfall._processCalls();

            this.verifyProfile(expectedRootProfile, waterfall._rootProfile);
        },

        'Valid Waterfall': function () {
            var waterfall = new Y.mojito.Waterfall({
                    stats: "Calls > 1"
                }),
                waterfallData,
                expectedRootProfile = {
                    id: 'root',
                    children: {
                        a: [
                            {
                                id: 'a',
                                children: {
                                    b: [
                                        {
                                            id: 'b'
                                        },
                                        {
                                            id: 'b',
                                            durations: {
                                                f: true
                                            },
                                            children: {
                                                c: [
                                                    {
                                                        id: 'c',
                                                        children: {
                                                            d: [
                                                                {
                                                                    id: 'd',
                                                                    durations: {
                                                                        e: true
                                                                    }
                                                                }
                                                            ]
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        ],
                        x: [
                            {
                                id: 'x',
                                children: {
                                    y: [
                                        {
                                            id: 'y',
                                            children: {
                                                z: [
                                                    {
                                                        id: 'z'
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                };

            waterfall.event('start');

            waterfall.start('a');
            waterfall.start('b');
            waterfall.start('b/c');
            waterfall.start('d:e');
            waterfall.end('d:e');
            waterfall.end('b');
            waterfall.end('b/c');
            waterfall.start('b:f');
            waterfall.end('b:f');
            waterfall.start('/x/y/z');
            waterfall.end('/x/y/z');
            waterfall.end('a');

            waterfall.event('end');

            waterfallData = waterfall.getGui();

            Assert.areSame(27, waterfall.getSummary().split('\n').length, 'Summary has an unexpected number of lines.');

            this.verifyProfile(expectedRootProfile, waterfall._rootProfile);
            //this.verifyGUI(waterfallData);
        },

        'Test Debug Time': function () {
            var Time = Y.mojito.Waterfall.Time,
                timeMap = {
                    "0": 0,
                    "5.75ps": 0.00000000575,
                    "5.75ns": 0.00000575,
                    "5.75\xB5s": 0.00575,
                    "5.75ms": 5.75,
                    "5.03125ms": 5.03125,
                    "5.75s": 5750,
                    "5min": 300000,
                    "1h": 3600000
                };

            Y.Object.each(timeMap, function (timeMs, timeStr) {
                Assert.areSame(timeStr, Time.msTimeToString(timeMs));
                Assert.areSame(Time.timeToMs(timeStr), timeMs);
            });

            Assert.areSame("5.03ms", Time.msTimeToString(5.03125, 3));
        }

    }));

    YUITest.TestRunner.add(suite);

}, '0.0.1', {
    requires: [
        'jsdom-node'
    ]
});
