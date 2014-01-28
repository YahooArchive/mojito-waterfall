/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint plusplus: true */
/*global YUI, unescape */

YUI.add('mojito-waterfall-table', function (Y, NAME) {
    'use strict';

    function WaterfallTable(data) {

        data = data || {};
        data.rows = data.rows || [];

        var COLORS = ['#3C953C', '#4465A7', '#993399', '#D63333', '#FF6600', '#CCCC00', '#A1A1A1'],
            EVENT_COLORS = ['#3355ff', '#ff3355', '#11cc22'],
            Time = Y.mojito.Waterfall.Time,
            tableContainer = Y.Node.create('<div/>'),
            table = Y.Node.create('<table cellpadding="0" cellspacing="0"/>').addClass('waterfall-table'),
            thead = Y.Node.create('<thead/>'),
            tbody = Y.Node.create('<tbody/>'),
            tfoot = Y.Node.create('<tfoot/>'),
            tr,
            td,
            cell,
            units = data.units = data.units || 'ms',
            startTime = Number.MAX_VALUE,
            endTime = Number.MIN_VALUE,
            numEvents = data.events ? data.events.length : 0,
            summaries = [],
            sortHeaders = [],
            tableData = [],
            createRow,
            normalizeTimes,
            getAbsoluteTimes,
            sortData,
            eventLineHeight = 25 * data.rows.length;

        // create header
        // add timeline to headers if not present
        if (data.headers[data.headers.length - 1] !== 'Timeline') {
            data.headers.push('Timeline');
        }
        tr = Y.Node.create('<tr/>');
        Y.each(data.headers, function (header, col) {
            var th = Y.Node.create('<th' + (header === 'Timeline' ? ' colspan="2" style="min-width:' + (data.timelineMinWidth || 0) + '"' : '') + '/>'),
                sortable = !data.sortColumns || !data.sortColumns[header] || data.sortColumns[header].sortable,
                headerTable = Y.Node.create('<table/>').addClass('sort no-select'),
                headerRow = Y.Node.create('<tr/>'),
                sortArrows = Y.Node.create('<td class="arrows"><div class="up">\u25B2</div><div class="down">\u25BC</div></td>');

            headerTable.addClass(header === 'Timeline' ? 'asc' : '');
            headerTable.addClass(sortable ? '' : 'disabled');

            sortHeaders.push(headerTable);
            headerTable.on('click', function () {
                var headerWasAsc = headerTable.hasClass('asc'),
                    defaultSortFunction = function (a, b) {
                        return a === b ? 0 : a > b ? 1 : -1;
                    },
                    sortRowGroup,
                    appendSortedRows;

                // reset all other columns
                Y.each(sortHeaders, function (sortHeader) {
                    sortHeader.removeClass('asc');
                    sortHeader.removeClass('desc');
                });

                // sort this column
                headerTable.addClass(headerWasAsc ? 'desc' : 'asc');
                tbody.set('innerHTML', '');

                sortRowGroup = function (rowGroup, parent) {
                    rowGroup.sort(function (a, b) {
                        var sortFunction = data.sortColumns && data.sortColumns[header] ?
                                    (data.sortColumns[header].sortFunction && data.sortColumns[header]) || defaultSortFunction
                                    : defaultSortFunction;
                        return (headerWasAsc ? -1 : 1) * sortFunction(a.columns[header], b.columns[header]);
                    });
                    if (parent) {
                        parent.details = rowGroup;
                    }
                    Y.each(rowGroup, function (row) {
                        if (Y.Lang.isArray(row.details)) {
                            sortRowGroup(row.details, rowGroup);
                        }
                    });
                };
                sortRowGroup(tableData, null);

                appendSortedRows = function (rowGroup) {
                    Y.each(rowGroup, function (row) {
                        tbody.append(row.dataRow);
                        if (Y.Lang.isArray(row.details)) {
                            appendSortedRows(row.details);
                        } else if (row.details !== undefined) {
                            tbody.append(row.details);
                        }
                    });
                };
                appendSortedRows(tableData);
            });

            headerRow.append('<td>' + header + '</td>');
            headerRow.append(sortArrows);
            headerTable.append(headerRow);
            th.append(headerTable);
            tr.append(th);
        });

        thead.append(tr);

        // sort rows by start time and get endTime
        sortData = function (dataRows) {
            dataRows.sort(function (a, b) {
                return a.startTime - b.startTime;
            });
            Y.each(dataRows, function (dataRow) {
                if (Y.Lang.isArray(dataRow.details)) {
                    sortData(dataRow.details);
                }
            });
        };
        sortData(data.rows);

        // determine absolute start and end times
        getAbsoluteTimes = function (rows) {
            Y.each(rows, function (row) {
                var rowEndTime = row.startTime;
                Y.each(row.durations, function (duration) {
                    rowEndTime += duration.duration;
                });
                endTime = Math.max(rowEndTime, endTime);
                startTime = Math.min(row.startTime, startTime);
                if (Y.Lang.isArray(row.details)) {
                    getAbsoluteTimes(row.details);
                }
            });
        };
        getAbsoluteTimes(data.rows);
        // take events into consideration
        Y.each(data.events, function (event) {
            endTime = Math.max(event.time, endTime);
            startTime = Math.min(event.time, startTime);
        });

        // create body
        createRow = function (row, depth, isLastChild) {
            var profile = Y.Node.create('<table/>').addClass('gradient profile'),
                profileDuration = 0,
                profileDurationText = Y.Node.create('<span/>').addClass('no-select light duration'),
                profileDurationTextTd = Y.Node.create('<td/>'),
                profileTr = Y.Node.create('<tr/>'),
                index = 0,
                relativeTime = 0,
                summary = {
                    'startTime': row.startTime - startTime,
                    'durations': []
                },
                tableDataRow = {
                    columns: {},
                    expanded: false
                },
                rowIndex = summaries.length,
                baseOffset = 4,
                paddingRight = 50,
                offset = depth * 12;

            tr = Y.Node.create('<tr/>');

            Y.Array.each(data.headers, function (header, columnIndex) {
                var toggleButton,
                    moved = false,
                    td = Y.Node.create('<td/>').addClass('no-select');

                // Create simulated border
                if (rowIndex !== 0) {
                    td.append(Y.Node.create('<div/>').addClass('simulated-border').append('<div/>'));
                }

                if (header !== 'Timeline') {
                    cell = Y.Node.create('<div/>').addClass('cell');
                    cell.append(Y.Node.create('<div/>').addClass('text').set('text', unescape(row[header])));

                    // append toggle button if there are details
                    if (columnIndex === 0) {
                        if (row.details !== undefined) {

                            toggleButton = Y.Node.create('<div/>').addClass('toggle no-select');
                            tr.on('mousemove', function () {
                                moved = true;
                            });
                            tr.on('mousedown', function () {
                                moved = false;
                            });
                            tr.on('mouseup', function () {
                                if (moved) {
                                    return;
                                }

                                // toggle the button
                                tableDataRow.expanded = !tableDataRow.expanded;
                                if (tableDataRow.expanded) {
                                    toggleButton.addClass('expanded');
                                } else {
                                    toggleButton.removeClass('expanded');
                                }

                                var toggleDetails = function (detailsRow, hide) {
                                    var content,
                                        showChild = detailsRow.expanded && !hide,
                                        callback = function () {
                                            // adjust height of event lines
                                            tbody.all('tr:first-child > td.timeline .event-line').setStyle('height', tbody.get('offsetHeight'));
                                        };

                                    // hide/show children
                                    if (detailsRow.details && !Y.Lang.isArray(detailsRow.details)) {
                                        content = detailsRow.details.one('div.detailsContainer');
                                        if (!showChild && content.getStyle('height') !== '0px') {
                                            content.setStyle('height', content.get('scrollHeight') + 'px');
                                        } else {
                                            detailsRow.details.show();
                                        }
                                        content.transition({
                                            easing: 'ease-out',
                                            duration: 0.3,
                                            height: showChild ? content.get('scrollHeight') + 'px' : '0px'
                                        }, function () {
                                            // need to set height to auto in case content inside change size
                                            if (showChild) {
                                                content.setStyle('height', 'auto');
                                            }
                                        });
                                    } else {

                                        Y.each(detailsRow.details, function (childDetailRow) {
                                            if (showChild) {
                                                childDetailRow.dataRow.show({duration: 0.1});
                                                callback();
                                            } else {
                                                childDetailRow.dataRow.hide({duration: 0.1}, callback);
                                            }
                                            toggleDetails(childDetailRow, hide);
                                        });
                                    }
                                };

                                toggleDetails(tableDataRow, !tableDataRow.expanded);
                            });
                        }
                        // set an increasing offset as depth increases
                        cell.setStyle('paddingLeft', baseOffset + offset);
                        cell.prepend(toggleButton);
                        td.append(cell);
                    } else {
                        // append cell data
                        td.append(cell);
                    }

                    tr.append(td);
                    tableDataRow.columns[header] = unescape(row[header]);
                }
            });

            // timeline cell
            td = Y.Node.create('<td/>').addClass('timeline no-select');

            cell = Y.Node.create('<div/>').addClass('timeline-length');

            // Create simulated border
            if (rowIndex !== 0) {
                td.append(Y.Node.create('<div/>').addClass('simulated-border').append('<div/>'));
            }

            // create event lines
            if (rowIndex === 0) {
                data.eventFilters = data.eventFilters || {};
                Y.Array.each(data.events, function (event, eventIndex) {
                    var groups,
                        color = (event.color || EVENT_COLORS[eventIndex % EVENT_COLORS.length]),
                        line = Y.Node.create('<div/>').addClass('event-line no-select').setStyle('borderRight', '1px solid ' + color)
                                     .setAttribute('name', 'event-line-' + eventIndex);

                    line.setStyle('height', eventLineHeight);

                    // Determine whether this event is enabled
                    event.enabled = true;
                    if (Y.Lang.isObject(data.eventFilters)) {
                        groups = event.group || event['class'] || event.name;
                        groups = Y.Lang.isArray(groups) ? groups : [groups];
                        if (data.eventFilters['All Events'] === false) {
                            event.enabled = false;
                        }
                        Y.Array.some(groups, function (group) {
                            if (data.eventFilters[group] === false) {
                                event.enabled = false;
                                return true;
                            }
                        });
                    }
                    if (event.enabled === false) {
                        line.hide();
                    }

                    event.index = eventIndex;
                    event.color = color;
                    line.setStyle('left', (100 * (event.time - startTime) / (endTime - startTime)) + '%');

                    event.color = color;
                    cell.append(line);
                });

                // Sort events by start time
                if (data.events) {
                    data.events.sort(function (a, b) {
                        return a.time > b.time ? 1 : a.time < b.time ? -1 :
                                a.index < b.index ? -1 : 1; // if events have the same time, then sort by original index;
                    });
                }
            }

            // create time slice
            Y.each(row.durations, function (duration) {
                profileDuration += duration.duration;
            });

            Y.each(row.durations, function (duration, i) {
                var defaultColor = COLORS[index % COLORS.length],
                    color = duration.color || (data.colors ? data.colors[duration.name] || defaultColor : defaultColor),
                    profileTd = Y.Node.create('<td/>').addClass('gradient').setStyle('backgroundColor', color);

                profileTd.setStyle('width', (100 * duration.duration / profileDuration) + '%');

                // do not append timeslice if there is more than one and this one has duration of 0
                if (duration.duration > 0 || row.durations.length === 1) {
                    profileTr.append(profileTd);
                }
                index++;

                summary.endTime += duration.duration;
                summary.durations.push({
                    startTime: relativeTime,
                    duration: duration.duration,
                    color: color,
                    name: duration.name
                });
                relativeTime += duration.duration;

                if (i === row.durations.length - 1) {
                    profile.setStyle('backgroundColor', color);
                }
            });
            profileDurationTextTd.append(profileDurationText);
            profileTr.append(profileDurationTextTd);

            summaries.push(summary);

            // set profile width
            profile.setStyle('width', (100 * profileDuration / (endTime - startTime)) + '%');

            profile.setStyle('left', ((100 * (row.startTime - startTime) / (endTime - startTime)) + '%'));
            profileDurationText.append(Time.timeToString(profileDuration + units, 3));

            profile.append(profileTr);

            cell.append(profile);

            cell = Y.Node.create('<div/>').addClass('timeline-cell').append(cell);

            td.append(cell);

            tr.append(td);

            tableDataRow.columns.Timeline = row.startTime;

            // hide rows that are not on the topmost level
            if (depth > 0) {
                tr.hide();
                tr.setStyle('opacity', 0);
            }
            tbody.append(tr);
            tableDataRow.dataRow = tr;

            // check if this row has details
            if (row.details !== undefined) {
                if (Y.Lang.isArray(row.details)) {
                    tableDataRow.details = [];
                    Y.each(row.details, function (childRow, childRowIndex) {
                        tableDataRow.details.push(createRow(childRow, depth + 1, childRowIndex === row.details.length));
                    });
                } else {
                    tr = Y.Node.create('<tr/>').addClass('details').hide();
                    td = Y.Node.create('<td/>').setAttribute('colspan', (data.headers.length + 2));
                    td.append('<div class="detailsContainer" style="height: 0px; padding-left:' + (offset + 10) + 'px"><div class="detailsWrapper">' + unescape(row.details) + '</div></div>');
                    tr.append(td);
                    tbody.append(tr);
                    tableDataRow.details = tr;
                }
            }

            return tableDataRow;
        };

        Y.each(data.rows, function (row, rowIndex) {
            tableData.push(createRow(row, 0));
        });

        table.append(thead);
        table.append(tbody);

        // create footer
        if (data.summary) {
            tr = Y.Node.create('<tr/>');
            Y.Array.each(data.headers, function (header) {
                td = Y.Node.create('<td/>');
                if (header === 'Timeline') {
                    td.setAttribute('colspan', 2);
                }
                td.append(unescape(data.summary[header] || ''));
                tr.append(td);
            });
            tfoot.append(tr);
            table.append(tfoot);
        }

        tableContainer.append(table);

        tableContainer.append(new Y.mojito.Waterfall.SummaryPopup(summaries, data.events, startTime, endTime - startTime, tableContainer, units));
        tableContainer.append(new Y.mojito.Waterfall.Ruler(tbody, endTime - startTime, units));

        return tableContainer;
    }

    Y.namespace('mojito.Waterfall').Table = WaterfallTable;
}, '0.1.0', {
    requires: [
        'node',
        'transition',
        'mojito-waterfall-time',
        'mojito-waterfall-ruler',
        'mojito-waterfall-summary-popup'
    ]
});
