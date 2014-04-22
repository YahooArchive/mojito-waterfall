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

        compareObjects: function (expected, actual, path) {
            path = path || 'root';

            var self = this;

            Assert.areEqual(typeof expected, typeof actual, 'Mismatching types. (' + path + ')');

            if (typeof expected === 'object') {
                //Assert.areEqual(Y.Object.size(expected), Y.Object.size(actual), 'Mismatching object size. (' + path + ')');
                Y.each(expected, function (expectedValue, key) {
                    self.compareObjects(expectedValue, actual[key], path + ', ' + key);
                });
            } else {
                Assert.areEqual(expected, actual, 'Mismatching value. (' + path + ')');
            }
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

            Assert.areSame(36, waterfall.getSummary().split('\n').length, 'Summary has an unexpected number of lines.');

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
        },

        'Test classes and groups': function () {
            var waterfall = new Y.mojito.Waterfall({
                classes: {
                    food: {
                        kind: 'food'
                    },
                    fruit: {
                        group: ['fruit', 'food'],
                        'class': 'food'
                    },
                    apple: {
                        'class': 'fruit'
                    },
                    banana: {
                        'class': ['fruit'],
                        group: 'yellow'
                    }
                }
            });

            waterfall.event('apple', {
                'class': 'apple'
            });

            waterfall.event('banana', {
                'class': 'banana',
                group: 'ripe banana'
            });

            waterfall = waterfall.getGui();

            this.compareObjects({
                'kind': 'food',
                'class': ['apple', 'fruit', 'food'],
                'group': ['fruit', 'food']
            }, waterfall.events[0]);

            this.compareObjects({
                'kind': 'food',
                'class': ['banana', 'fruit', 'food'],
                'group': ['ripe banana', 'yellow', 'fruit', 'food']
            }, waterfall.events[1]);
        },

        'Test Merge Method': function () {
            var waterfall1 = new Y.mojito.Waterfall({
                    headers: [
                        'header1'
                    ]
                }),
                waterfall2 = new Y.mojito.Waterfall({
                    headers: [
                        'header2'
                    ]
                }),
                time,
                actual,
                expected = {
                    headers: [
                        'Name',
                        'header1',
                        'header2'
                    ],
                    rows: [{
                        Name: 'a1',
                        details: [{
                            Name: 'b1'
                        }]
                    }, {
                        Name: 'z1 (1)'
                    }, {
                        Name: 'z1 (2)'
                    }, {
                        Name: 'a2',
                        details: [{
                            Name: 'b2'
                        }]
                    }, {
                        Name: 'z1'
                    }, {
                        Name: 'z2'
                    }],

                    events: [{
                        name: 'event1'
                    }, {
                        name: 'event2'
                    }]
                };

            time = process.hrtime();

            waterfall1.start('a1');
            waterfall1.start('b1');
            waterfall1.end('b1');
            waterfall1.end('a1');
            waterfall1.start('z1');
            waterfall1.event('event1');
            waterfall1.end('z1');
            waterfall1.start('z1');
            waterfall1.end('z1');

            time = process.hrtime(time);

            waterfall2.start('a2');
            waterfall2.start('b2');
            waterfall1.event('event2');
            waterfall2.end('b2');
            waterfall2.end('a2');
            waterfall2.start('z1');
            waterfall2.end('z1');
            waterfall2.start('z2');
            waterfall2.end('z2');

            waterfall1.merge(waterfall2, time[1]);

            actual = waterfall1.getGui();

            this.compareObjects(expected, actual);
        }

    }));

    YUITest.TestRunner.add(suite);

}, '0.0.1', {
    requires: [
        'jsdom-node'
    ]
});
