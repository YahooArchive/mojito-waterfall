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

        var COLORS = ["#3C953C", "#4465A7", "#993399", "#D63333", "#FF6600", "#CCCC00", "#A1A1A1"],
            EVENT_COLORS = ["#3355ff", "#ff3355", "#11cc22"],
            table = Y.Node.create("<table cellpadding='0' cellspacing='0'/>").addClass('waterfall-table'),
            thead = Y.Node.create("<thead/>"),
            tbody = Y.Node.create("<tbody/>"),
            tfoot = Y.Node.create("<tfoot/>"),
            tr,
            td,
            startTime = Number.MAX_VALUE,
            endTime = Number.MIN_VALUE,
            numEvents = data.events ? data.events.length : 0,
            summaries = [],
            sortHeaders = [],
            tableData = [],
            msTimeToString = Y.mojito.Waterfall.Time.msTimeToString,
            timeToMs = Y.mojito.Waterfall.Time.timeToMs,
            createRow,
            normalizeTimes,
            getAbsoluteTimes,
            sortData;

        data = data || {};
        data.rows = data.rows || [];

        // convert all times to ms
        normalizeTimes = function (rows) {
            Y.Array.each(rows, function (row) {
                row.startTime = data.units && typeof row.startTime === "number" ? row.startTime + data.units : row.startTime;
                row.startTime = timeToMs(row.startTime);
                Y.each(row.durations, function (duration) {
                    duration.duration = data.units && typeof duration.duration === "number" ? duration.duration + data.units : duration.duration;
                    duration.duration = timeToMs(duration.duration);
                });
                if (Y.Lang.isArray(row.details)) {
                    normalizeTimes(row.details);
                }
            });
        };
        normalizeTimes(data.rows);
        Y.each(data.events, function (event) {
            event.time = data.units && typeof event.time === "number" ? event.time + data.units : event.time;
            event.time = timeToMs(event.time);
        });

        // create header
        // add timeline to headers if not present
        if (data.headers[data.headers.length - 1] !== "Timeline") {
            data.headers.push("Timeline");
        }
        tr = Y.Node.create("<tr/>");
        Y.each(data.headers, function (header, col) {
            var th = Y.Node.create("<th" + (header === "Timeline" ? " style='min-width:" + (data.timelineMinWidth || 0) + "'" : "") + "/>"),
                sortable = !data.sortColumns || !data.sortColumns[header] || data.sortColumns[header].sortable,
                headerTable = Y.Node.create("<table class='sort no-select'/>"),
                headerRow = Y.Node.create("<tr/>"),
                sortArrows = Y.Node.create("<td class='arrows'><div class='up'>\u25B2</div><div class='down'>\u25BC</div></td>");

            headerTable.addClass(header === "Timeline" ? "asc" : "");
            headerTable.addClass(sortable ? "" : "disabled");

            sortHeaders.push(headerTable);
            headerTable.on("click", function () {
                var headerWasAsc = headerTable.hasClass("asc"),
                    defaultSortFunction = function (a, b) {
                        return a === b ? 0 : a > b ? 1 : -1;
                    },
                    sortRowGroup,
                    appendSortedRows;

                // reset all other columns
                Y.each(sortHeaders, function (sortHeader) {
                    sortHeader.removeClass("asc");
                    sortHeader.removeClass("desc");
                });

                // sort this column
                headerTable.addClass(headerWasAsc ? "desc" : "asc");
                tbody.set("innerHTML", "");

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

            headerRow.append("<td>" + header + "</td>");
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
            var timeSlice = Y.Node.create("<table class='gradient timeline'/>"),
                timeSliceDuration = 0,
                timeSliceDurationText = Y.Node.create("<span class='no-select light duration'></span>"),
                timeSliceDurationTextTd = Y.Node.create("<td/>"),
                timeSliceTr = Y.Node.create("<tr/>"),
                index = 0,
                relativeTime = 0,
                summary = {
                    "startTime": row.startTime - startTime,
                    "durations": []
                },
                tableDataRow = {
                    columns: {},
                    expanded: false
                },
                rowIndex = summaries.length,
                baseOffset = 4,
                paddingRight = 50,
                offset = depth * 12;

            tr = Y.Node.create("<tr/>");
            Y.each(data.headers, function (header, columnIndex) {
                var toggleButton,
                    td = Y.Node.create("<td class='no-select'/>");
                if (header !== "Timeline") {
                    // set an increasing offset as depth increases
                    if (columnIndex === 0) {
                        td.setStyle("paddingLeft", baseOffset + offset);
                    }
                    // append toggle button if there are details
                    if (columnIndex === 0 && row.details !== undefined) {

                        toggleButton = Y.Node.create("<div class='toggle no-select'>&nbsp;</div>");
                        tr.on('click', function () {
                            // toggle the button
                            tableDataRow.expanded = !tableDataRow.expanded;
                            if (tableDataRow.expanded) {
                                toggleButton.addClass("expanded");
                            } else {
                                toggleButton.removeClass("expanded");
                            }

                            var toggleDetails = function (detailsRow, hide) {
                                var content,
                                    showChild = detailsRow.expanded && !hide;

                                // hide/show children
                                if (detailsRow.details && !Y.Lang.isArray(detailsRow.details)) {
                                    content = detailsRow.details.one("div.detailsContainer");
                                    if (!showChild && content.getStyle("height") !== "0px") {
                                        content.setStyle("height", content.get("scrollHeight") + "px");
                                    } else {
                                        detailsRow.details.show();
                                    }
                                    content.transition({
                                        easing: 'ease-out',
                                        duration: 0.3,
                                        height: showChild ? content.get("scrollHeight") + "px" : "0px"
                                    }, function () {
                                        // need to set height to auto in case content inside change size
                                        if (showChild) {
                                            content.setStyle("height", "auto");
                                        }
                                    });
                                } else {
                                    Y.each(detailsRow.details, function (childDetailRow) {
                                        if (showChild) {
                                            childDetailRow.dataRow.show({duration: 0.1});
                                        } else {
                                            childDetailRow.dataRow.hide({duration: 0.1});
                                        }
                                        toggleDetails(childDetailRow, hide);
                                    });
                                }
                            };

                            toggleDetails(tableDataRow, !tableDataRow.expanded);

                        });
                        td.append(toggleButton);
                        td.append("<div style='padding-left: 11px'>" + unescape(row[header]) + "</div>");
                    } else {
                        // append cell data
                        td.append(unescape(row[header]));
                    }

                    tr.append(td);
                    tableDataRow.columns[header] = unescape(row[header]);
                }
            });

            // create timeline cell and set padding on right such that there is space for duration on the right
            td = Y.Node.create("<td class='no-select'/>").setStyle('paddingRight', paddingRight);
            // create event lines
            Y.each(data.events, function (event, eventIndex) {
                var color = (event.color || EVENT_COLORS[eventIndex % EVENT_COLORS.length]),
                    line = Y.Node.create("<div class='event-line' style='border-right:1px solid " + color +  "'/>");
                line.setStyle("left", (100 * (event.time - startTime) / (endTime - startTime)) + "%");
                // TODO: event lines seem to only be pushed to the right by 1 pixel when there are other lines
                line.setStyle("marginLeft", eventIndex > 0 ? -1 : 0);
                event.color = color;
                td.append(line);
            });

            // create time slice
            Y.each(row.durations, function (duration) {
                timeSliceDuration += duration.duration;
            });

            Y.each(row.durations, function (duration, i) {
                var defaultColor = COLORS[index % COLORS.length],
                    color = duration.color || (data.colors ? data.colors[duration.type] || defaultColor : defaultColor),
                    timeSliceTd = Y.Node.create("<td class='gradient' style='background-color:" + color + "'/>");
                timeSliceTd.setStyle("width", (100 * duration.duration / timeSliceDuration) + "%");

                // do not append timeslice if there is more than one and this one has duration of 0
                if (duration.duration > 0 || row.durations.length === 1) {
                    timeSliceTr.append(timeSliceTd);
                }
                index++;

                summary.durations.push({
                    "startTime": relativeTime,
                    "duration": duration.duration,
                    "color": color,
                    "type": duration.type
                });
                relativeTime += duration.duration;

                if (i === row.durations.length - 1) {
                    timeSlice.setStyle('backgroundColor', color);
                }
            });
            timeSliceDurationTextTd.append(timeSliceDurationText);
            timeSliceTr.append(timeSliceDurationTextTd);

            summaries.push(summary);

            // Make sure the width is not exactly 100%, otherwise some browsers will present the event lines above timeline.
            timeSlice.setStyle("width", Math.min(99.9999, 100 * timeSliceDuration / (endTime - startTime)) + "%");

            timeSlice.setStyle("left", ((100 * (row.startTime - startTime) / (endTime - startTime)) + "%"));
            timeSliceDurationText.append(msTimeToString(timeSliceDuration, 3));

            timeSlice.append(timeSliceTr);

            td.append(timeSlice);

            tr.append(td);
            tableDataRow.columns.Timeline = row.startTime;

            // hide rows that are not on the topmost level
            if (depth > 0) {
                tr.hide();
                tr.setStyle("opacity", 0);
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
                    tr = Y.Node.create("<tr class='details'/>").hide();
                    td = Y.Node.create("<td colspan='" + (data.headers.length + 1) + "'/>");
                    td.append("<div class='detailsContainer' style='height: 0px; padding-left:" + (offset + 10) + "px'><div class='detailsWrapper'>" + unescape(row.details) + "</div></div>");
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
            tr = Y.Node.create("<tr/>");
            Y.each(data.headers, function (header) {
                td = Y.Node.create("<td/>");
                td.append(unescape(data.summary[header] || ""));
                tr.append(td);
            });
            tfoot.append(tr);
            table.append(tfoot);
        }

        // make events relative to start
        Y.each(data.events, function (event) {
            event.time = event.time - startTime;
        });

        table.append(new Y.mojito.Waterfall.SummaryPopup(summaries, data.events, endTime - startTime, table));
        table.append(new Y.mojito.Waterfall.Ruler(tbody, endTime - startTime));

        return table;
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
