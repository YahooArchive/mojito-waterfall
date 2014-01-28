/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint plusplus: true */
/*global YUI */

YUI.add('mojito-waterfall-event-filters', function (Y, NAME) {
    'use strict';

    var MAX_COLUMNS = 8;

    function EventFilter(groupName, events, eventFilters, waterfallTable) {
        var filter = Y.Node.create('<label/>').addClass('filter'),
            checkbox = Y.Node.create('<input>').set('type', 'checkbox'),
            color,
            name = groupName + ' (' + events.length + ')',
            text = Y.Node.create('<span/>').addClass('real');

        // Set the color
        Y.Array.some(events, function (event) {
            if (!color) {
                color = event.color;
            } else if (color !== event.color) {
                color = 'black';
                return true;
            }
        });
        filter.setStyle('color', color);

        filter.append(checkbox)
              .append(Y.Node.create('<span/>').addClass('fake').append(name))
              .append(text);

        this.groupName = groupName;
        this.eventFilters = eventFilters;
        this.checkbox = checkbox;
        this.text = text;
        this.events = events;
        this.waterfallTable = waterfallTable;

        checkbox.on('change', function () {
            this.enabled = this.checkbox.get('checked');
            this.onStateChange();
        }.bind(filter));

        filter.on('mouseover', function () {
            this.highlightEvents(true);
        }.bind(filter));

        filter.on('mouseout', function () {
            this.highlightEvents(false);
        }.bind(filter));

        this.updateState();

        Y.mix(filter, this);
        Y.mix(filter, EventFilter.prototype);

        return filter;
    }

    EventFilter.prototype = {

        onStateChange: function () {
            this.text.set('text', this.groupName + ' (' + (this.enabled ? this.events.length : 0) + ')');
            this.toggleEvents();
            Y.Object.each(this.eventFilters, function (eventFilter, groupName) {
                if (groupName !== this.groupName) {
                    eventFilter.updateState();
                }
            }.bind(this));
        },

        updateCheckbox: function () {
            if (this.enabled === null) {
                this.checkbox.set('indeterminate', true);
            } else {
                this.checkbox.set('indeterminate', false);
                this.checkbox.set('checked', this.enabled);
            }
        },

        toggleEvents: function () {
            if (this.enabled === true || this.enabled === false) {
                Y.Array.each(this.events, function (event) {
                    // Update the event on the waterfall.
                    if (event.enabled !== this.enabled) {
                        event.enabled = this.enabled;
                        this.waterfallTable.all('tbody td.timeline div[name="event-line-' + event.index + '"]')[event.enabled ? 'show' : 'hide']();
                    }
                }.bind(this));
            }
        },

        highlightEvents: function (highlight) {
            Y.Array.each(this.events, function (event) {
                if (event.enabled) {
                    this.waterfallTable.all('tbody td.timeline  div.event-line[name="event-line-' + event.index + '"]')
                                       .setStyle('borderWidth', highlight ? '3px' : '1px')
                                       .setStyle('marginLeft', highlight ? '-1px' : '0px');
                }
            }.bind(this));
        },

        updateState: function () {
            var filterEnabled,
                numEnabled = 0;
            Y.Array.each(this.events, function (event) {
                if (event.enabled) {
                    numEnabled++;
                }
                if (filterEnabled === undefined) {
                    filterEnabled = event.enabled;
                } else if (filterEnabled !== event.enabled) {
                    filterEnabled = null;
                }
            });

            this.text.set('text', this.groupName + ' (' + numEnabled + ')');

            if (this.enabled !== filterEnabled) {
                this.enabled = filterEnabled;
                this.updateCheckbox();
            }
        }
    };

    function EventFilters(events, waterfallTable) {
        var groups = {},
            groupArray,
            eventFilters = {},
            fieldset = Y.Node.create('<fieldset/>'),
            legend = Y.Node.create('<legend>Event Filters</legend>'),
            filters = Y.Node.create('<div/>').addClass('event-filters');

        // Determine all the different groups.
        // Events belong to the groups it specifies; if no group specified then it belongs to
        // its own group (its name).
        Y.Array.each(events, function (event) {
            var groupArray = event.group || event.name;

            groupArray = Y.Lang.isArray(groupArray) ? groupArray : [groupArray];
            // All events belong to the 'All Events' group.
            groupArray.unshift('All Events');

            Y.Array.each(groupArray, function (group) {
                groups[group] = groups[group] || [];
                groups[group].push(event);
            });
        });

        // Sort groups with All Events in the front
        groupArray = Y.Object.keys(groups).sort();
        groupArray.splice(groupArray.indexOf('All Events'), 1);
        groupArray.unshift('All Events');

        Y.Array.each(groupArray, function (groupName) {
            var groupEvents = groups[groupName],
                filter = Y.Node.create('<span/>');

            eventFilters[groupName] = new EventFilter(groupName, groupEvents, eventFilters, waterfallTable);
            filters.append(eventFilters[groupName]);
        });

        fieldset.append(legend)
                .append(filters);

        return fieldset;
    }

    Y.namespace('mojito.Waterfall').EventFilters = EventFilters;
}, '0.0.1', {
    requires: [
        'node',
        'node-event-simulate'
    ]
});
