/*jslint node: true, regexp: true, nomen: true, evil: true, plusplus: true */
/*global YUI, escape */

YUI.add('mojito-waterfall', function (Y, NAME) {
    'use strict';

    var PROFILE_KEY_REGEX = /^(\/?[^\/:]+)+(\/[^\/:]+)*(:[^\/:]+)?$/, ///^(\^?\s*[^\^:\~]+(:[^\^:\~]+)*)?(~[^\^~:]+)?$/,
        STATS_TYPES = ['Name', 'Calls', 'Total Duration', 'Avg Duration', 'Min Duration', 'Max Duration'],
        WaterfallNamespace = Y.namespace('mojito.Waterfall'),
        isBrowser = typeof window === 'object';

    function ProfileKey(key) {
        this.profiles = [];
        this.duration = null;

        if (key.indexOf('/') === 0) {
            this.root = true;
            key = key.replace('/', '');
        }

        this.profiles = key.split('/');
        Y.Array.each(this.profiles, function (profile, i) {
            this.profiles[i] = profile.trim();
        }.bind(this));

        if (this.profiles[this.profiles.length - 1].indexOf(':') !== -1) {
            var split = this.profiles[this.profiles.length - 1].split(':');
            this.profiles[this.profiles.length - 1] = split[0].trim();
            this.duration = split[1].trim();
        }

        this.toString = function () {
            this.str = this.str || (this.root ? '/' : '') + this.profiles.join('/') + (this.duration ? ':' + this.duration : '');
            return this.str;
        };
    }

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
        compareTo: isBrowser ? function (otherProfile) {
            return this.startTime > otherProfile.startTime ? 1 : this.startTime < otherProfile.startTime ? -1 : 0;
        } : function (otherProfile) {
            var i = this.startTime[0] === otherProfile.startTime[0] ? 1 : 0;
            return this.startTime[i] > otherProfile.startTime[i] ? 1 : this.startTime[i] < otherProfile.startTime[i] ? -1 : 0;
        },

        set: function (setData) {
            // find profile
            var profile = this.profile;

            if (profile.duration) {
                profile.duration.startTime = profile.duration.startTime || setData.startTime;
                profile.duration.endTime = profile.duration.endTime || setData.endTime;
            } else {
                profile.startTime = profile.startTime || setData.startTime;
                profile.endTime = profile.endTime || setData.endTime;
            }

            profile.data = Y.mix(profile.data, setData.data);
            this.type = profile.data.type || this.type;
        },

        add: function (profile, parentProfile) {
            var self = this,
                profileArray,
                children,
                lastProfile;

            parentProfile = parentProfile || this.profile;
            children = parentProfile.children;

            if (!profile.id) {
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

            // if last profile is open and the profile to be added had children then continue through it
            //if (lastProfile.startTime === undefined && !Y.Object.isEmpty(profile.children) {
            if (lastProfile.startTime === undefined && !Y.Object.isEmpty(profile.children)) {
                Y.Object.each(profile.children, function (childProfileArray) {
                    Y.Array.each(childProfileArray, function (childProfile) {
                        self.add(childProfile, lastProfile);
                    });
                });
            } else if (lastProfile.startTime === undefined) {
                lastProfile.startTime = profile.startTime;
                lastProfile.endTime = profile.endTime;
            } else {
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
        this._warnings = [];
        this._timeProfiles = [{
            details: {}
        }];

        this._now = isBrowser ? ((window.performance && (
            window.performance.now    ||
            window.performance.mozNow ||
            window.performance.msNow  ||
            window.performance.oNow   ||
            window.performance.webkitNow
        )) || function () {
            return new Date().getTime();
        }) : process.hrtime;
    }

    Waterfall.prototype = {

        configure: function (config) {
            Y.mix(this.config, config, true, null, 0, true);
        },

        start: function (profileKey, data) {
            var time = this._now();
            this._calls.push({
                profileKey: profileKey,
                time: time,
                data: data,
                type: 'start'
            });
            return time;
        },

        end: function (profileKey, data) {
            var time = this._now();
            this._calls.push({
                time: time,
                profileKey: profileKey,
                data: data,
                type: 'end'
            });
            return time;
        },

        event: function (name, data) {
            var time = this._now();
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
                statsTopExpression = this.config && this.config.stats && this.config.stats.top,
                profileFilterExpression = this.config && this.config.stats && this.config.stats.profileFilter;

            if (waterfall) {
                return waterfall;
            }

            this._disable();

            this._processCalls();

            self.absoluteEndTime = 0;

            waterfall = {
                headers: this.headers || [],
                rows: [],
                units: isBrowser ? 'ms' : 'ns',
                events: [],
                summary: {}
            };

            // add mandatory 'Name' header
            if (waterfall.headers.indexOf('Name') === -1) {
                waterfall.headers.unshift('Name');
            }

            createRows = function (profile, rows, topProfile, ancestors) {
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

                    // TODO: check for overlap

                    row.durations.push({
                        type: durationType,
                        duration: duration
                    });

                    totalDuration += duration;

                    // update the entry's start and end time according to its children entries
                    profile.startTime = profile.startTime !== undefined ? Math.min(profile.startTime, startTime) : startTime;
                    profile.endTime = profile.endTime !== undefined ? Math.max(profile.endTime, endTime) : endTime;

                    // add stat
                    self.stats[durationType] = self.stats[durationType] || [];
                    self.stats[durationType].push({
                        topProfile: topProfile,
                        profile: profile,
                        startTime: startTime,
                        endTime: endTime,
                        hasAncestorOfSameType: ancestors[durationType] !== undefined
                    });
                });

                // create rows for children entries
                Y.Object.each(profile.children, function (profileArray, profileName) {
                    var profileStartTime,
                        profileEndTime;

                    Y.Array.each(profileArray, function (childProfile, index) {
                        var newTopProfile,
                            childRow,
                            topExpression = statsTopExpression,
                            newAncestors = Y.clone(ancestors);

                        childProfile.data.Name = childProfile.data.Name || childProfile.type;

                        newAncestors[profile.type] = true;

                        if (self._executeExpression(topExpression, childProfile.data)) {
                            newTopProfile = childProfile;
                        }

                        newTopProfile = newTopProfile || topProfile || childProfile;

                        childRow = createRows(childProfile, row.details, newTopProfile, newAncestors);
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

    //Y.mix(row, profile.data);
                row.startTime = profile.startTime;
                row.endTime = profile.endTime;
                if (row.details.length === 0) {
                    delete row.details;
                }
                rows.push(row);

                // add stat
                if (self._executeExpression(profileFilterExpression, profile.data) !== false) {
                    self.stats[profile.type] = self.stats[profile.type] || [];
                    self.stats[profile.type].push({
                        topProfile: topProfile,
                        profile: profile,
                        startTime: profile.startTime,
                        endTime: profile.endTime,
                        hasAncestorOfSameType: ancestors[profile.type] !== undefined
                    });
                }

                self.absoluteEndTime = Math.max(self.absoluteEndTime, profile.endTime || 0);
                return row;
            };

            // create events
            Y.Array.each(this.events, function (event) {
                event.time = self._normalize(event.time);
                self.absoluteEndTime = Math.max(self.absoluteEndTime, event.time || 0);
            });
            waterfall.events = this.events;

            // create rows
            createRows(this._rootProfile, waterfall.rows, null, {});
            // remove top level row, which refers to root of all profiles
            waterfall.rows = waterfall.rows[0].details;

            // calculate statistics
            waterfall.stats = this._calcStats();

            // add summary
            waterfall.summary = {
                Timeline: escape('<div style="text-align:right">' +
                                'Total Execution Time: ' +
                                Y.mojito.Waterfall.Time.msTimeToString(self._timeToMs(self.absoluteEndTime), 4) + '</div>')
            };

            this.waterfall = waterfall;

            return waterfall;
        },

        getSummary: function () {
            var waterfall = this.getGui(),
                columnWidths = [],
                i,
                headerRow,
                row,
                statStr;

            Y.Object.each(waterfall.stats, function (stat, statName) {
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

            statStr += 'Total Execution Time: ' + Y.mojito.Waterfall.Time.msTimeToString(this._timeToMs(this.absoluteEndTime), 4) + '\n';

            return statStr;
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

                args.profileKey = args.profileKey.trim();
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
                        // error
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

        _calcStats: function () {
            var self = this,
                stats = {},
                msTimeToString = Y.mojito.Waterfall.Time.msTimeToString,
                statsFilterExpression = this.config && this.config.stats && this.config.stats.statsFilter,
                summarySorter = function (a, b) {
                    return b.Duration - a.Duration;
                };

            Y.Object.each(this.stats, function (statArray, statType) {
                if (statType === 'root') {
                    return;
                }

                var stat = {
                        'Name': statType,
                        'Calls': statArray.length,
                        'Total Duration': 0,
                        'Avg Duration': 0,
                        'Min Duration': 0,
                        'Max Duration': 0,
                        summary: []
                    },
                    totalNonOverlappingDuration = 0,
                    totalDuration = 0,
                    minDuration = {},
                    maxDuration = {};

                Y.Array.each(statArray, function (statValue) {
                    var duration = statValue.endTime - statValue.startTime,
                        profileName = (statValue.topProfile || statValue.profile).data.Name;
                    if (minDuration.duration === undefined || duration < minDuration.duration) {
                        minDuration.duration = duration;
                        minDuration.name = profileName;
                    }
                    if (maxDuration.duration === undefined || duration > maxDuration.duration) {
                        maxDuration.duration = duration;
                        maxDuration.name = profileName;
                    }

                    totalDuration += duration;
                    if (!statValue.hasAncestorOfSameType) {
                        totalNonOverlappingDuration += duration;
                    }
                    stat.summary.push({
                        Name: profileName,
                        Duration: duration
                    });
                });

                stat['Total Duration'] = totalNonOverlappingDuration;//totalDuration;
                stat['Avg Duration'] = totalDuration / statArray.length;
                stat['Min Duration'] = minDuration.duration;
                stat['Max Duration'] = maxDuration.duration;

                // determine whether to add stat based on config
                if (self._executeExpression(statsFilterExpression, stat) === false) {
                    return;
                }

                stat['Total Duration'] = msTimeToString(self._timeToMs(stat['Total Duration']), 4);
                stat['Avg Duration'] = msTimeToString(self._timeToMs(stat['Avg Duration']), 4);
                stat['Min Duration'] = msTimeToString(self._timeToMs(stat['Min Duration']), 4) + ' (' + minDuration.name + ')';
                stat['Max Duration'] = msTimeToString(self._timeToMs(stat['Max Duration']), 4) + ' (' + maxDuration.name + ')';

                // sort summary
                stat.summary.sort(summarySorter);
                // stringify durations
                Y.Array.each(stat.summary, function (summary) {
                    summary.Duration = msTimeToString(self._timeToMs(summary.Duration), 4);
                });

                stats[statType] = stat;
            });
            return stats;
        },

        _timeToMs: function (time) {
            return isBrowser ? time : time / 1e6;
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
        },

        _executeExpression: function (expression, values) {
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
        }
    };

    Y.namespace('mojito').Waterfall = Waterfall;
    Y.mix(Y.namespace('mojito').Waterfall, WaterfallNamespace);

}, '0.1.0', {
    requires: [
        'mojito-waterfall-time'
    ]
});
