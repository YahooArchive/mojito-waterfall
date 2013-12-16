/*jslint node: true, regexp: true, nomen: true, evil: true, plusplus: true */
/*global YUI, escape */

YUI.add('waterfall', function (Y, NAME) {
    'use strict';

    var PROFILE_KEY_REGEX = /^(\^?\s*[^\^:\~]+(:[^\^:\~]+)*)?(~[^\^~:]+)?$/,
        STATS_TYPES = ['Name', 'Calls', 'Total Duration', 'Avg Duration', 'Min Duration', 'Max Duration'],
        WaterfallNamespace = Y.namespace('Waterfall');

    function ProfileKey(key) {
        this.profiles = [];
        this.duration = null;

        key = key.trim();
        if (key.indexOf('^') === 0) {
            this.root = true;
            key = key.replace('^', '');
        }

        this.profiles = key.split(/\s*:\s*/);

        if (this.profiles[this.profiles.length - 1].indexOf('~') !== -1) {
            var split = this.profiles[this.profiles.length - 1].split('~');
            this.profiles[this.profiles.length - 1] = split[0].trim();
            this.duration = split[1].trim();
        }

        this.toString = function () {
            this.str = this.str || this.profiles.join(': ') + (this.duration ? ' ~ ' + this.duration : '');
            return this.str;
        };
    }

    function Profile(profileKey, root) {
        this.profileKey = profileKey;
        this.name = profileKey.profiles[0];
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
        },

        add: function (profile, parentProfile) {
            var self = this,
                profileArray,
                children,
                lastProfile;

            parentProfile = parentProfile || this.profile;
            children = parentProfile.children;

            if (!profile.name) {
                parentProfile.durations = parentProfile.durations || {};
                Y.mix(parentProfile.durations, profile.durations);
                return;
            }

            if (!children[profile.name]) {
                children[profile.name] = [profile];
                return;
            }

            profileArray = children[profile.name];
            lastProfile = profileArray[profileArray.length - 1];

            // if last profile is open and the profile to be added had children then continue through it
            if (lastProfile.startTime === undefined && !Y.Object.isEmpty(profile.children)) {
                Y.Object.each(profile.children, function (childProfileArray) {
                    Y.Array.each(childProfileArray, function (childProfile) {
                        self.add(childProfile, lastProfile);
                    });
                });
            } else {
                profileArray.push(profile);
            }
        }
    };

    Y.Waterfall = function (config) {
        this.config = config;
        this.headers = config && config.headers;
        this.stats = {};
        this._calls = [];
        this._warnings = [];
        this.events = [];
        this._timeProfiles = [{
            details: {}
        }];

        this._stats = {};
    };

    Y.mix(Y.Waterfall, WaterfallNamespace);



    Y.Waterfall.prototype = {

        start: function (profileKey, data) {
            this._calls.push({
                profileKey: profileKey,
                time: process.hrtime(),
                data: data,
                type: 'start'
            });
        },

        end: function (profileKey, data) {
            this._calls.push({
                time: process.hrtime(),
                profileKey: profileKey,
                data: data,
                type: 'end'
            });
        },

        event: function (name, data) {
            this._calls.push({
                time: process.hrtime(),
                type: 'event',
                data: data,
                name: name
            });
        },


        clear: function () {
            this._calls = [];
        },

        stop: function () {
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

        get: function () {
            var waterfall = this.waterfall,
                self = this,
                createRows,
                statsTopExpression = this.config && this.config.stats && this.config.stats.top;

            if (waterfall) {
                return waterfall;
            }

            this._processCalls();

            self.absoluteEndTime = 0;
            self.absoluteStartTime = self.absoluteStartTime || 0;

            waterfall = {
                headers: this.headers || [],
                rows: [],
                units: 'ns',
                events: [],
                summary: {}
            };

            // add mandatory 'Name' header
            if (waterfall.headers.indexOf('Name') === -1) {
                waterfall.headers.unshift('Name');
            }

            createRows = function (profile, rows, topProfile, ancestors) {
                var row = {
                        durations: []
                    },
                    totalTime,
                    totalDuration = 0;

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

                        newAncestors[profile.name] = true;

                        childProfile.data.Name = childProfile.data.Name || childProfile.name + (index > 0 ? ' (' + (index + 1) + ')' : '');

                        if (topExpression) {
                            Y.Object.each(childProfile.data, function (value, key) {
                                value = typeof value === 'string' ? '\'' + value + '\'' : value;
                                topExpression = topExpression.replace(new RegExp(key, 'g'), value);
                            });
                            try {
                                newTopProfile = eval(topExpression) ? childProfile : null;
                            } catch (e) {
                                newTopProfile = null;
                            }
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

                Y.mix(row, profile.data);
                row.startTime = profile.startTime;
                row.endTime = profile.endTime;
                if (row.details.length === 0) {
                    delete row.details;
                }
                rows.push(row);

                // add stat
                self.stats[profile.name] = self.stats[profile.name] || [];
                self.stats[profile.name].push({
                    topProfile: topProfile,
                    profile: profile,
                    startTime: profile.startTime,
                    endTime: profile.endTime,
                    hasAncestorOfSameType: ancestors[profile.name] !== undefined
                });

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
                                Y.Waterfall.Time.msTimeToString(self.absoluteEndTime / 1e6, 4) + '</div>')
            };

            this.waterfall = waterfall;

            return waterfall;
        },

        getSummary: function () {
            var waterfall = this.get(),
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

            statStr += 'Total Execution Time: ' + Y.Waterfall.Time.msTimeToString(this.absoluteEndTime / 1e6, 4) + '\n';

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

                if (!args.profileKey || !PROFILE_KEY_REGEX.test(args.profileKey.trim())) {
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

                        if (i === 1) {
                            stack.splice(i, 1);
                            rootProfile.add(profile);
                            return;
                        }

                        // leave this root profile in order to maintain start order
                        if (profileKey.root) {
                            return;
                        }

                        // find parent
                        j = i - 1;
                        do {
                            parent = stack[j--];
                        } while (parent.profileKey.root || parent.closed);

                        // add closed profile to its parent if its parent is not closed or a 'root profile'
                        // don't add to rootProfile because start order should be maintained
                        if (!parent.closed && !parent.profileKey.root && parent !== rootProfile) {
                            stack.splice(i, 1);
                            parent.add(profile);
                        }
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
                            rootProfile.add(childProfile);
                        });
                    });
                } else {
                    rootProfile.add(profile);
                }
            });

            this._rootProfile = rootProfile;
        },

        _error: function (message, profileKeyStr) {
            Y.log('Error when profiling \'' + profileKeyStr + '\': ' + message, 'error', NAME);
        },

        _calcStats: function () {
            var stats = {},
                statsFilterExpression = this.config && this.config.stats && this.config.stats.filter,
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
                    filterExpression,
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
                if (statsFilterExpression) {
                    filterExpression = statsFilterExpression;
                    Y.Array.each(STATS_TYPES, function (s) {
                        var value = typeof stat[s] === 'string' ? '\'' + stat[s] + '\'' : stat[s];
                        filterExpression = filterExpression.replace(new RegExp(s, 'g'), value);
                    });

                    try {
                        if (!eval(filterExpression)) {
                            return;
                        }
                    } catch (e) {
                        return;
                    }
                }

                stat['Total Duration'] = Y.Waterfall.Time.msTimeToString(stat['Total Duration'] / 1e6, 4);
                stat['Avg Duration'] = Y.Waterfall.Time.msTimeToString(stat['Avg Duration'] / 1e6, 4);
                stat['Min Duration'] = Y.Waterfall.Time.msTimeToString(stat['Min Duration'] / 1e6, 4) + ' (' + minDuration.name + ')';
                stat['Max Duration'] = Y.Waterfall.Time.msTimeToString(stat['Max Duration'] / 1e6, 4) + ' (' + maxDuration.name + ')';

                // sort summary
                stat.summary.sort(summarySorter);
                // stringify durations
                Y.Array.each(stat.summary, function (summary) {
                    summary.Duration = Y.Waterfall.Time.msTimeToString(summary.Duration / 1e6, 4);
                });

                stats[statType] = stat;
            });
            return stats;
        },

        _normalize: function (time) {
            if (!time) {
                return undefined;
            }
            var ns = time[1] - this.absoluteStartTime[1],
                s = time[0] - this.absoluteStartTime[0];
            return s * 1e9 + ns;
        }
    };

}, '0.1.0', {
    requires: [
        'base',
        'waterfall-time'
    ]
});
