/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint browser: true, node: true, regexp: true, nomen: true, evil: true, plusplus: true, continue: true */
/*global YUI, escape */

YUI.add('mojito-waterfall', function (Y, NAME) {
    'use strict';

    var PROFILE_KEY_REGEX = /^(\/?[^\/:]+)+(\/[^\/:]+)*(:[^\/:]+)?$/,
        STATS_TYPES = ['Name', 'Calls', 'Total Duration', 'Avg Duration', 'Min Duration', 'Max Duration'],
        Time = Y.mojito.Waterfall.Time,
        WaterfallNamespace = Y.namespace('mojito.Waterfall'),
        isBrowser = typeof window === 'object';

    /**
     * Representation of a profile key (the string used to create a profile).
     * Determines if the key starts at the root, breaks down the path
     * and keeps track of any duration.
     * @class ProfileKey
     * @constructor
     * @param {String} key
     */
    function ProfileKey(key) {
        var parts;

        this.profiles = [];
        this.duration = null;
        this.root = key.indexOf('/') === 0;

        // Get all the profiles in the key.
        parts = key.split('/');
        Y.Array.each(parts, function (profile, i) {
            profile = profile.trim();
            if (profile) {
                this.profiles.push(profile);
            }
        }.bind(this));

        // Get the duration if it exists.
        if (this.profiles[this.profiles.length - 1].indexOf(':') !== -1) {
            parts = this.profiles[this.profiles.length - 1].split(':');
            this.profiles[this.profiles.length - 1] = parts[0].trim();
            this.duration = parts[1].trim();
        }
    }

    ProfileKey.prototype = {

        toString: function () {
            this.str = this.str || (this.root ? '/' : '') + this.profiles.join('/') + (this.duration ? ':' + this.duration : '');
            return this.str;
        }
    };

    /**
     * Representation of a profile. Includes any children profiles and durations.
     * @class Profile
     * @constructor
     * @param {String} profileKey
     */
    function Profile(profileKey, root) {
        this.profileKey = profileKey;
        this.id = profileKey.profiles[0];
        this.type = this.id;
        this.durations = null;
        this.children = {};
        this.data = {};

        root = root || this;

        if (profileKey.profiles.length === 1) {
            root.profile = this;
        } else if (profileKey.profiles.length > 1) {
            this.children[profileKey.profiles[1]] = [new Profile({
                profiles: profileKey.profiles.slice(1),
                duration: profileKey.duration
            }, root)];
        }

        if (profileKey.duration) {
            this.durations = {};
            this.duration = this.durations[profileKey.duration] = {};
        }
    }

    Profile.prototype = {

        /**
         * Sets start and end times and any data associated with this profile.
         * @param {Object} setData
         */
        set: function (setData) {
            var profile = this.profile;

            if (profile.duration) {
                profile.duration.startTime = profile.duration.startTime || setData.startTime;
                profile.duration.endTime = profile.duration.endTime || setData.endTime;
            } else {
                profile.startTime = profile.startTime || setData.startTime;
                profile.endTime = profile.endTime || setData.endTime;
            }

            Y.mix(profile.data, setData.data, true, null, 0, true);

            this.type = profile.data.type || this.type;
        },

        /**
         * Adds a profile to this profile. Recursively merges the profile's children
         * with this profile's children.
         * @param {Object} profile
         * @param {Object} parentProfile
         */
        add: function (profile, parentProfile) {
            var self = this,
                profileArray,
                children,
                lastProfile;

            parentProfile = parentProfile || this.profile;
            children = parentProfile.children;

            if (!profile.id) {
                // This profile is a simple profile just containing durations,
                // so the durations should go directly to the parent profile.
                parentProfile.durations = parentProfile.durations || {};
                Y.mix(parentProfile.durations, profile.durations);
                return;
            }

            if (!children[profile.id]) {
                children[profile.id] = [profile];
                return;
            }

            profileArray = children[profile.id];
            lastProfile = profileArray[profileArray.length - 1];

            if (profile.durations) {
                // This profile has durations for the a profile with the id.
                lastProfile.durations = lastProfile.durations || {};
                Y.mix(lastProfile.durations, profile.durations);
            } else if (lastProfile.startTime === undefined && !Y.Object.isEmpty(profile.children)) {
                // If last profile is open and the profile to be added has children, add children to the last profile.
                Y.Object.each(profile.children, function (childProfileArray) {
                    Y.Array.each(childProfileArray, function (childProfile) {
                        self.add(childProfile, lastProfile);
                    });
                });
            } else if (lastProfile.startTime === undefined) {
                // If profile to be added has no children, merge with last profile.
                lastProfile.startTime = profile.startTime;
                lastProfile.endTime = profile.endTime;
                lastProfile.type = profile.data.type || lastProfile.type;
                Y.mix(lastProfile.data, profile.data, true, null, 0, true);
            } else {
                // If last profile is closed, just append new profile.
                profileArray.push(profile);
            }
        }
    };

    function Waterfall(config) {
        this.config = config;
        this.headers = config && config.headers;
        this.events = [];
        this.stats = {};

        this._calls = [];
    }

    Waterfall.now = (function () {
        if (!isBrowser) {
            return process.hrtime;
        }

        if (window.top.performance && window.top.performance.now) {
            return function () {
                return window.top.performance.now();
            };
        }

        return function () {
            return new Date().getTime();
        };
    }());

    Waterfall._timeToMs = function (time) {
        return isBrowser ? time : time / 1e6;
    };

    Waterfall._executeExpression = function (expression, values) {
        var valueExpression,
            variables,
            i = 0;
        // determine whether to add stat based on config
        if (!expression) {
            return null;
        }

        // get variables
        variables = expression.split(/[^\d\w\s\'\"]/);
        while (i < variables.length) {
            variables[i] = variables[i].trim();
            // remove empty variables and values
            if (!variables[i] || /^((\d+)|(\'.*\')|(\".*\")|(true)|(false)|(null)|(undefined)|(NaN))$/.test(variables[i])) {
                variables.splice(i, 1);
                continue;
            }
            i++;
        }
        // sort by longest length first in case a variable name is a substring of another
        variables.sort(function (a, b) {
            return a.length > b.length ? -1 : a.length < b.length ? 1 : 0;
        });

        valueExpression = expression;
        Y.Array.some(variables, function (v) {
            var value = typeof values[v] === 'string' ? '\'' + values[v] + '\'' : values[v];
            valueExpression = valueExpression.replace(new RegExp(v, 'g'), value);
        });

        try {
            return eval(valueExpression);
        } catch (e) {
            Y.log('Error executing the expression "' + expression + '" = "' + valueExpression + '": ' + e.message, 'error', NAME);
            return null;
        }
    };

    Waterfall.getSummary = function (waterfall) {

        waterfall.stats = waterfall.stats || Waterfall.computeStats(waterfall);

        var columnWidths = [],
            i,
            headerRow,
            row,
            statStr;

        Y.Object.each(waterfall.stats, function (stat, statName) {
            if (!Y.Lang.isObject(stat)) {
                return;
            }
            Y.Array.each(STATS_TYPES, function (statType, column) {
                columnWidths[column] = Math.max(String(stat[statType]).length, columnWidths[column] || statType.length);
            });
        });

        row = '+';
        headerRow = '+';

        Y.Array.each(columnWidths, function (width) {
            for (i = 0; i < width + 2; i++) {
                row += '-';
                headerRow += '=';
            }
            row += '+';
            headerRow += '+';
        });

        statStr = headerRow + '\n|';

        Y.Array.each(STATS_TYPES, function (statType, column) {
            statStr += ' ' + statType + ' ';
            for (i = statType.length; i < columnWidths[column]; i++) {
                statStr += ' ';
            }
            statStr += '|';
        });

        statStr += '\n' + headerRow + '\n';

        Y.Object.each(waterfall.stats, function (stat, statName) {
            if (!Y.Lang.isObject(stat)) {
                return;
            }
            statStr += '|';
            Y.Array.each(STATS_TYPES, function (statType, column) {
                statStr += ' ' + stat[statType] + ' ';
                for (i = String(stat[statType]).length; i < columnWidths[column]; i++) {
                    statStr += ' ';
                }
                statStr += '|';
            });
            statStr += '\n' + row + '\n';
        });

        if (waterfall.stats.totalDuration) {
            statStr += 'Total Execution Time: ' + Time.timeToString(waterfall.stats.totalDuration, 4) + '\n';
        }

        return statStr;
    };

    Waterfall.computeStats = function (waterfall) {
        var stats = {},
            config = waterfall.config,
            units = waterfall.units || '',
            minTime,
            maxTime,
            profileFilter = config && config.stats && config.stats.profileFilter,
            statsTop = config && config.stats && config.stats.top,
            statsFilter = config && config.stats && config.stats.statsFilter,
            summarySorter = function (a, b) {
                return b.Duration - a.Duration;
            },
            addStat = function (profile, duration, root) {
                if (Waterfall._executeExpression(profileFilter, profile) === false) {
                    return;
                }
                var type = profile.type || profile.Name;

                stats[type] = stats[type] || [];
                stats[type].push({
                    duration: duration,
                    root: root
                });
            },
            getStats = function (rows, root) {
                if (!rows) {
                    return;
                }

                // Get the names of all the rows in order to give them unique names that indicate
                // order based on start time.
                var names = {};
                rows.sort(function (a, b) {
                    return a.startTime > b.startTime ? 1 : a.startTime < b.startTime ? -1 : 0;
                });
                Y.Array.each(rows, function (row) {
                    var name = row.Name;
                    names[name] = names[name] === undefined ? 0 : 1;
                });

                Y.Array.each(rows, function (row) {
                    var name = row.Name,
                        endTime = row.startTime;
                    if (names[name]) {
                        row.Name = name + ' (' + names[name] + ')';
                        names[name]++;
                    }

                    Y.Array.each(row.durations, function (duration) {
                        endTime += duration.duration;
                        if (duration.type !== 'Elapsed Time') {
                            addStat(duration, duration.duration, root);
                        }
                    });
                    row.endTime = row.endTime || endTime;

                    minTime = Math.min(minTime, row.startTime) || row.startTime;
                    maxTime = Math.max(maxTime, row.endTime) || row.endTime;

                    addStat(row, row.endTime - row.startTime, root || row.Name);
                    getStats(row.details, root || row.Name);
                });
            };

        getStats(waterfall.rows);

        Y.Object.each(stats, function (statArray, statType) {
            var stat = {
                    'Name': statType,
                    'Calls': statArray.length,
                    'Total Duration': 0,
                    'Avg Duration': 0,
                    'Min Duration': 0,
                    'Max Duration': 0,
                    summary: []
                },
                totalDuration = 0,
                minDuration = {},
                maxDuration = {};

            Y.Array.each(statArray, function (statValue) {
                var duration = statValue.duration,
                    name = statValue.root;
                if (minDuration.duration === undefined || duration < minDuration.duration) {
                    minDuration.duration = duration;
                    minDuration.name = name;
                }
                if (maxDuration.duration === undefined || duration > maxDuration.duration) {
                    maxDuration.duration = duration;
                    maxDuration.name = name;
                }

                totalDuration += duration;

                stat.summary.push({
                    Name: name,
                    Duration: duration
                });
            });

            stat['Total Duration'] = totalDuration;
            stat['Avg Duration'] = totalDuration / statArray.length;
            stat['Min Duration'] = minDuration.duration;
            stat['Max Duration'] = maxDuration.duration;

            // determine whether to add stat based on config
            if (Waterfall._executeExpression(statsFilter, stat) === false) {
                return;
            }

            stat['Total Duration'] = Time.timeToString(stat['Total Duration'] + units, 4);
            stat['Avg Duration'] = Time.timeToString(stat['Avg Duration'] + units, 4);
            stat['Min Duration'] = Time.timeToString(stat['Min Duration'] + units, 4) + (minDuration.name === statType ? '' : ' (' + minDuration.name + ')');
            stat['Max Duration'] = Time.timeToString(stat['Max Duration'] + units, 4) + (maxDuration.name === statType ? '' : ' (' + maxDuration.name + ')');

            // sort summary
            stat.summary.sort(summarySorter);
            // stringify durations
            Y.Array.each(stat.summary, function (summary) {
                summary.Duration = Time.timeToString(summary.Duration + units, 4);
            });

            stats[statType] = stat;
        });
        stats.totalDuration = maxTime - minTime;

        return stats;
    };

    Waterfall.merge = function (waterfall1, waterfall2, timeShift, config) {

        waterfall1 = (waterfall1.getGui && waterfall1.getGui()) || waterfall1;
        waterfall2 = (waterfall2.getGui && waterfall2.getGui()) || waterfall2;

        waterfall1.units = waterfall1.units || 'ms';
        waterfall2.units = waterfall2.units || 'ms';

        var mergedWaterfall = {
                config: config || waterfall1.config || waterfall2.config,
                units: waterfall1.units,
                headers: (waterfall1.headers && waterfall1.headers.slice(0)) || [],
                rows: (waterfall1.rows && Y.clone(waterfall1.rows)) || [],
                events: (waterfall1.events && Y.clone(waterfall1.events)) || [],
                absoluteStartTime: Math.min(waterfall1.absoluteStartTime,
                    Time.convertTime(waterfall2.absoluteStartTime + waterfall2.units, waterfall1.units))
            },
            shiftAndConvertTimes = function (rows) {
                var rowsCopy = [];
                Y.Array.each(rows, function (row) {
                    var rowCopy = {
                        durations: [],
                        startTime: Time.convertTime(row.startTime + waterfall2.units, mergedWaterfall.units) + timeShift,
                        endTime: Time.convertTime(row.endTime + waterfall2.units, mergedWaterfall.units) + timeShift
                    };
                    if (isNaN(rowCopy.startTime)) {
                        delete rowCopy.startTime;
                    }
                    if (isNaN(rowCopy.endTime)) {
                        delete rowCopy.endTime;
                    }
                    Y.Array.each(row.durations, function (duration) {
                        var durationCopy = {};
                        durationCopy.duration = Time.convertTime(duration.duration + waterfall2.units, mergedWaterfall.units);
                        Y.mix(durationCopy, duration);
                        rowCopy.durations.push(durationCopy);
                    });
                    rowCopy.details = row.details && shiftAndConvertTimes(row.details);
                    Y.mix(rowCopy, row);
                    rowsCopy.push(rowCopy);
                });
                return rowsCopy;
            };

        timeShift = timeShift ? Time.convertTime(timeShift, mergedWaterfall.units) : 0;

        // Merge headers.
        Y.Array.each(waterfall2.headers, function (header) {
            if (mergedWaterfall.headers.indexOf(header) === -1) {
                mergedWaterfall.headers.push(header);
            }
        });

        // Merge rows.
        Array.prototype.push.apply(mergedWaterfall.rows, shiftAndConvertTimes(waterfall2.rows));

        // Merge events.
        Y.Array.each(waterfall2.events, function (event) {
            var eventCopy = {};
            eventCopy.time = Time.convertTime(event.time + waterfall2.units, mergedWaterfall.units) + timeShift;
            Y.mix(eventCopy, event);
            mergedWaterfall.events.push(eventCopy);
        });

        // Compute merged stats.
        mergedWaterfall.stats = Waterfall.computeStats(mergedWaterfall);

        // Add summary.

        mergedWaterfall.summary = {
            Timeline: escape('<div style="text-align:right">' +
                            'Total Execution Time: ' +
                            Time.timeToString(mergedWaterfall.stats.totalDuration + mergedWaterfall.units, 4) + '</div>')
        };

        return mergedWaterfall;
    };

    Waterfall.prototype = {

        configure: function (config) {
            Y.mix(this.config, config, true, null, 0, true);
        },

        start: function (profileKey, data) {
            var time = Waterfall.now();
            this._calls.push({
                profileKey: profileKey,
                time: time,
                data: data,
                type: 'start'
            });
            return time;
        },

        end: function (profileKey, data) {
            var time = Waterfall.now();
            this._calls.push({
                time: time,
                profileKey: profileKey,
                data: data,
                type: 'end'
            });
            return time;
        },

        event: function (name, data) {
            var time = Waterfall.now();
            this._calls.push({
                time: time,
                type: 'event',
                data: data,
                name: name
            });
            return time;
        },

        clear: function () {
            this._calls = [];
        },

        pause: function () {
            this._originalStart = this._originalStart || this.start;
            this._originalEnd = this._originalEnd || this.end;
            this._originalEvent = this._originalEvent || this.event;
            this.start = function () {};
            this.end = function () {};
            this.event = function () {};
        },

        resume: function () {
            this.start = this._originalStart || this.start;
            this.end = this._originalEnd || this.end;
            this.event = this._originalEvent || this.event;
            delete this._originalStart;
            delete this._originalEnd;
            delete this._originalEvent;
        },

        getGui: function () {
            var waterfall = this.waterfall,
                self = this,
                createRows,
                absoluteEndTime = 0;

            if (waterfall) {
                return waterfall;
            }

            this._disable();

            this._processCalls();

            waterfall = {
                config: this.config,
                headers: this.headers || [],
                rows: [],
                units: isBrowser ? 'ms' : 'ns',
                events: [],
                summary: {},
                absoluteStartTime: isBrowser ? this.absoluteStartTime : this.absoluteStartTime[0] * 1e9 + this.absoluteStartTime[1]
            };

            // add mandatory 'Name' header
            if (waterfall.headers.indexOf('Name') === -1) {
                waterfall.headers.unshift('Name');
            }

            createRows = function (profile, rows) {
                var row = profile.data || {},
                    totalTime,
                    totalDuration = 0;

                row.durations =  [];

                profile.startTime = self._normalize(profile.startTime);
                profile.endTime = self._normalize(profile.endTime);

                row.details = [];

                // create durations
                Y.Object.each(profile.durations, function (durationObj, durationType) {
                    var startTime = self._normalize(durationObj.startTime),
                        endTime = self._normalize(durationObj.endTime),
                        duration = endTime - startTime;

                    row.durations.push({
                        type: durationType,
                        duration: duration
                    });

                    totalDuration += duration;

                    // update the entry's start and end time according to its children entries
                    profile.startTime = profile.startTime !== undefined ? Math.min(profile.startTime, startTime) : startTime;
                    profile.endTime = profile.endTime !== undefined ? Math.max(profile.endTime, endTime) : endTime;
                });

                // create rows for children entries
                Y.Object.each(profile.children, function (profileArray, profileName) {
                    var profileStartTime,
                        profileEndTime;

                    Y.Array.each(profileArray, function (childProfile, index) {
                        var childRow;

                        childProfile.data.Name = childProfile.data.Name || childProfile.type;

                        childRow = createRows(childProfile, row.details);
                        profileStartTime = profileStartTime !== undefined ? profileStartTime : childRow.startTime;
                        profileEndTime = childRow.endTime;
                    });

                    // update the entry's start and end time according to its children entries
                    profile.startTime = profile.startTime !== undefined ? Math.min(profile.startTime, profileStartTime) : profileStartTime;
                    profile.endTime = profile.endTime !== undefined ? Math.max(profile.endTime, profileEndTime) : profileEndTime;
                });

                // add default duration 'Elapsed Time'
                totalTime = (profile.endTime - profile.startTime);
                if (row.durations.length === 0) {
                    row.durations.push({
                        type: 'Elapsed Time',
                        duration: totalTime
                    });
                } else if (totalDuration < totalTime) {
                    row.durations.push({
                        type: 'Other',
                        duration: totalTime - totalDuration
                    });
                }

                row.startTime = profile.startTime;
                row.endTime = profile.endTime;
                if (row.details.length === 0) {
                    delete row.details;
                }
                rows.push(row);

                absoluteEndTime = Math.max(absoluteEndTime, profile.endTime || 0);
                return row;
            };

            // create events
            Y.Array.each(this.events, function (event) {
                event.time = self._normalize(event.time);
                absoluteEndTime = Math.max(absoluteEndTime, event.time || 0);
            });
            waterfall.events = this.events;

            // create rows
            createRows(this._rootProfile, waterfall.rows);
            // remove top level row, which refers to root of all profiles
            waterfall.rows = waterfall.rows[0].details;

            // calculate statistics
            waterfall.stats = Waterfall.computeStats(waterfall);

            // add summary
            waterfall.summary = {
                Timeline: escape('<div style="text-align:right">' +
                                'Total Execution Time: ' +
                                Time.msTimeToString(Waterfall._timeToMs(absoluteEndTime), 4) + '</div>')
            };

            this.waterfall = waterfall;

            return waterfall;
        },

        getSummary: function () {
            var waterfall = this.getGui();
            return Waterfall.getSummary(waterfall);
        },

        merge: function (otherWaterfall, timeShift) {
            this.waterfall = Waterfall.merge(this, otherWaterfall, timeShift, this.config);
            return this.waterfall;
        },

        _processCalls: function () {
            if (this._rootProfile) {
                return this._rootProfile;
            }

            var self = this,
                i,
                j,
                stack = [],
                rootProfile = new Profile({
                    profiles: ['root']
                });

            // push the root profile to the stack
            stack.push(rootProfile);

            Y.Array.each(this._calls, function (args) {
                var profile,
                    profileKey,
                    parent;

                self.absoluteStartTime = self.absoluteStartTime !== undefined ? self.absoluteStartTime : (args.type === 'start' || args.type === 'event' ? args.time : undefined);

                if (args.type === 'event') {
                    self.events.push(Y.mix(args.data || {}, {
                        type: args.name,
                        time: args.time
                    }));
                    return;
                }

                args.profileKey = (args.profileKey || '').trim();
                if (!args.profileKey || !PROFILE_KEY_REGEX.test(args.profileKey)) {
                    self._error("Invalid profile.", args.profileKey);
                    return;
                }

                profileKey = new ProfileKey(args.profileKey);

                // if start, create profile and push to the stack
                if (args.type === 'start') {
                    profile = new Profile(profileKey);
                    profile.set({
                        startTime: args.time,
                        data: args.data
                    });
                    stack.push(profile);
                } else {
                    // if end, find the profile starting from the top of the stack
                    for (i = stack.length - 1; i > 0; i--) {
                        if (stack[i].profileKey.toString() === profileKey.toString()) {
                            profile = stack[i];
                            break;
                        }
                    }
                    // if profile was found add end time, and add it to its parent
                    if (profile) {
                        profile.set({
                            endTime: args.time,
                            data: args.data
                        });

                        profile.closed = true;
                        stack.splice(i, 1);

                        // leave this root profile in order to maintain start order
                        if (profileKey.root) {
                            parent = stack[0];
                        } else {
                            parent = stack[i - 1];
                        }

                        // add closed profile to its parent
                        parent.add(profile);
                    } else {
                        self._error('Start was never called.', profileKey);
                    }
                }
            });

            // add remaining profiles to the rootProfile
            Y.Array.each(stack, function (profile, index) {
                if (index === 0) {
                    return;
                }

                // if profile is not closed then report error
                if (!profile.closed) {
                    self._error('End was never called.', profile.profileKey);
                    // add children profiles directly to root
                    Y.Object.each(profile.children, function (childArray) {
                        Y.Array.each(childArray, function (childProfile) {
                            if (childProfile.closed) {
                                rootProfile.add(childProfile);
                            }
                        });
                    });
                }
            });

            this._rootProfile = rootProfile;
        },

        _error: function (message, profileKeyStr) {
            Y.log('Error when profiling \'' + profileKeyStr + '\': ' + message, 'error', NAME);
        },

        _normalize: function (time) {
            if (!time) {
                return undefined;
            }

            if (isBrowser) {
                return time - this.absoluteStartTime;
            }

            var ns = time[1] - this.absoluteStartTime[1],
                s = time[0] - this.absoluteStartTime[0];
            return s * 1e9 + ns;
        },

        _disable: function () {
            var disabled = function () {
                this._error('Cannot continue profiling after the waterfall has been finalized.');
            };
            this.configure = this.start = this.end = this.event = this.clear = this.pause = this.resume = disabled;
        }
    };

    Y.namespace('mojito').Waterfall = Waterfall;
    Y.mix(Y.namespace('mojito').Waterfall, WaterfallNamespace);

}, '0.1.0', {
    requires: [
        'base',
        'mojito-waterfall-time'
    ]
});
