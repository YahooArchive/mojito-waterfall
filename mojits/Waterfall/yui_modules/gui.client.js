/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint plusplus: true */
/*global YUI, unescape */

YUI.add('mojito-waterfall-gui', function (Y, NAME) {
    'use strict';

    Y.namespace('mojito.Waterfall').GUI = function (data) {

        var waterfall,
            waterfallData = data,
            waterfallDomObject,

            WaterfallSummary = function (summaries, events, waterfallTbody) {

                var startTimeDescription = "Start time since the beginning",
                    phasesDescription = "Phases start and elapsed time relative to the start:",
                    eventsDescription = "Event timing relative to the start:",
                    tableContainer = Y.Node.create("<div style='position:absolute'/>"),
                    table = Y.Node.create("<table cellspacing='3px' class='waterfall-summary'></table>"),
                    currentSummary,
                    self = this;

                this.get = function () {
                    return tableContainer;
                };

                this.hide = function () {
                    tableContainer.hide();
                };

                this.move = function (mouseX, mouseY) {
                    var topLimit = waterfallTbody.getY(),
                        rightLimit = waterfallTbody.get("offsetWidth") + waterfallTbody.getX(),
                        bottomLimit = waterfallTbody.get("offsetHeight") + waterfallTbody.getY(),
                        tableWidth = table.get("offsetWidth"),
                        tableHeight = table.get("offsetHeight"),
                        spacing = 10;

                    tableContainer.setXY([
                        Math.min(mouseX + spacing, rightLimit - tableWidth),
                        Math.max(topLimit, Math.min(mouseY + spacing, bottomLimit - tableHeight))
                    ]);
                };

                this.showSummary = function (num, mouseX, mouseY) {

                    if (num === currentSummary) {
                        tableContainer.show();
                        self.move(mouseX, mouseY);
                        return;
                    }

                    table.set("innerHTML", "");

                    var tr,
                        td,
                        msTimeToString = Y.mojito.Waterfall.Time.msTimeToString;

                    // vertical space
                    table.append("<tr><td colspan='4' class='vertical-space'></td></tr>");

                    // start time and description
                    tr = Y.Node.create("<tr class='start-time'/>");
                    tr.append("<td/>");
                    td = Y.Node.create("<td class='time'>" + (summaries[num].startTime > 0 ? "+" : "") + msTimeToString(summaries[num].startTime, 3) + "</td>");
                    tr.append(td);
                    tr.append("<td colspan='2' class='description' nowrap>" + startTimeDescription + "</td>");
                    table.append(tr);

                    // vertical space
                    table.append("<tr><td colspan='4' class='vertical-space'></td></tr>");

                    // phases description
                    table.append("<tr class='breakdown-description'><td colspan='4' class='description'>" + phasesDescription + "</td></tr>");

                    // breakdowns
                    Y.each(summaries[num].durations, function (duration) {
                        tr = Y.Node.create("<tr class='breakdown'></tr>");
                        tr.append("<td class='type-color gradient' style='background-color:" + duration.color + "'></td>");
                        tr.append("<td class='time'>" + (duration.startTime > 0 ? "+" : "") + msTimeToString(duration.startTime, 3) + "</td>");
                        tr.append("<td class='duration'>" + (duration.duration > 0 ? "+" : "") + msTimeToString(duration.duration, 3) + "</td>");
                        tr.append("<td class='type'>" + duration.type + "</td>");
                        table.append(tr);
                    });

                    if (events && events.length > 0) {
                        // vertical space
                        table.append("<tr><td colspan='4' class='vertical-space'></td></tr>");

                        // events description
                        table.append("<tr class='breakdown-description'><td colspan='4' class='description'>" + eventsDescription + "</td></tr>");

                        // events
                        Y.each(events, function (event) {
                            var relativeTime = event.time - summaries[num].startTime;
                            tr = Y.Node.create("<tr class='breakdown'></tr>");
                            tr.append("<td><div class='event-color' style='border-left: 2px solid " + event.color + "'/></td>");
                            tr.append("<td class='time'>" + (relativeTime > 0 ? "+" : "") + msTimeToString(relativeTime, 3) + "</td>");
                            tr.append("<td class='type' colspan='2'>" + event.type + "</td>");
                            table.append(tr);
                        });
                    }

                    // vertical space
                    table.append("<tr><td colspan='4' class='vertical-space'></td></tr>");

                    tableContainer.append(table);
                    tableContainer.show();
                    self.move(mouseX, mouseY);
                    currentSummary = num;
                };

                this.hide();
            },

            WaterfallRuler = function () {
                var ruler = Y.Node.create("<div class='waterfall-ruler'/>").hide(),
                    length = Y.Node.create("<div class='light length'/>"),
                    enabled = false,
                    top,
                    left;

                ruler.append(Y.Node.create("<div class='top lines'/>"));
                ruler.append(Y.Node.create("<div class='bottom lines'/>"));
                ruler.append(length);

                this.get = function () {
                    return ruler;
                };

                this.isEnabled = function () {
                    return enabled;
                };

                this.start = function (mouseX, mouseY) {
                    left = mouseX;
                    top = mouseY;
                    enabled = true;
                };

                this.update = function (mouseX, mouseY, timeLineWidthPx, timeLineLengthMs) {

                    var time;
                    // move ruler and set width/height
                    if (!enabled) {
                        return;
                    }

                    ruler.show();

                    ruler.setStyle("left", Math.min(left, mouseX));
                    ruler.setStyle("top", Math.min(top, mouseY));
                    ruler.setStyle("width", Math.abs(left - mouseX));
                    ruler.setStyle("height", Math.abs(top - mouseY));

                    // update time length
                    time = (Math.abs(left - mouseX) / timeLineWidthPx) * timeLineLengthMs;
                    length.set("text", Y.mojito.Waterfall.Time.msTimeToString(time, 3));
                    length.setStyle("marginLeft", -1 * length.getStyle("width").replace("px", "") / 2);
                };

                this.end = function () {
                    enabled = false;
                    ruler.hide();
                };
            },

            WaterfallStats = function (stats) {
                var fieldset,
                    legend,
                    table,
                    thead,
                    tbody,
                    th,
                    tr,
                    td,
                    rows = [],
                    waterfallStats,
                    popup,
                    popupSummary,
                    popupData;

                this.get = function () {
                    if (table) {
                        waterfallStats = Y.Node.create("<div/>");
                        waterfallStats.append("<br/>");
                        fieldset = Y.Node.create("<fieldset/>").addClass('waterfall').addClass('stats');
                        legend = Y.Node.create("<legend>Statistics</legend>");
                        legend.on('click', function () {
                            table.toggleView();
                        });
                        fieldset.append(legend);
                        fieldset.append(table);
                        waterfallStats.append(fieldset);
                    }
                    return waterfallStats;
                };

                if (!stats || Y.Object.isEmpty(stats)) {
                    return;
                }

                // sort stats


                // get popup data


                table = Y.Node.create("<table cellpadding='0' cellspacing='0'/>");

                // create header
                thead = Y.Node.create("<thead/>");
                tr = Y.Node.create("<tr/>");
                Y.Array.each(Object.keys(stats[Object.keys(stats)[0]]), function (header) {
                    if (header === "summary") {
                        return;
                    }
                    th = Y.Node.create("<th>" + header + "</th>");
                    tr.append(th);
                });
                thead.append(tr);
                table.append(thead);

                // create body
                tbody = Y.Node.create("<tbody/>");
                Y.Object.each(stats, function (stat) {
                    tr = Y.Node.create("<tr/>");
                    Y.Object.each(stat, function (statValue, header) {
                        if (header === "summary") {
                            return;
                        }
                        td = Y.Node.create("<td>" + statValue + "</td>");
                        tr.append(td);
                    });
                    tbody.append(tr);

                    rows.push(stat);
                });
                table.append(tbody);

                // attach popup
                popup = new Y.mojito.Waterfall.Popup(tbody, waterfall, function (popup, row) {
                    var summary = rows[row].summary;
                    popup.set("innerHTML", "");
                    if (!summary || summary.length === 0) {
                        return;
                    }
                    popupSummary = Y.Node.create("<table cellspacing='10px' cellpadding='3px'/>");
                    // create header
                    thead = Y.Node.create("<thead/>").addClass('stat-popup');
                    tr = Y.Node.create("<tr/>");
                    Y.Array.each(Object.keys(summary[0]), function (header) {
                        th = Y.Node.create("<th>" + header + "</th>");
                        tr.append(th);
                    });
                    thead.append(tr);
                    popupSummary.append(thead);

                    // create body
                    tbody = Y.Node.create("<tbody/>");
                    Y.Array.each(summary, function (summaryObj) {
                        tr = Y.Node.create("<tr/>");
                        Y.Object.each(summaryObj, function (value) {
                            td = Y.Node.create("<td>" + value + "</td>");
                            tr.append(td);
                        });
                        tbody.append(tr);
                    });
                    popupSummary.append(tbody);
                    popup.append(popupSummary);
                }, null, 'stat');
            },

            create = function (data, waterfallDomObject) {

                var COLORS = ["#3C953C", "#4465A7", "#993399", "#D63333", "#FF6600", "#CCCC00", "#A1A1A1"],
                    EVENT_COLORS = ["#3355ff", "#ff3355", "#11cc22"],
                    table = Y.Node.create("<table cellpadding='0' cellspacing='0'/>"),
                    thead = Y.Node.create("<thead/>"),
                    tbody = Y.Node.create("<tbody/>"),
                    tfoot = Y.Node.create("<tfoot/>"),
                    tr,
                    td,
                    startTime = Number.MAX_VALUE,
                    endTime = Number.MIN_VALUE,
                    numEvents = data.events ? data.events.length : 0,
                    summaries = [],
                    waterfallSummary,
                    waterfallRuler,
                    waterfallStats,
                    sortHeaders = [],
                    tableData = [],
                    msTimeToString = Y.mojito.Waterfall.Time.msTimeToString,
                    timeToMs = Y.mojito.Waterfall.Time.timeToMs,
                    createRow,
                    normalizeTimes,
                    getAbsoluteTimes,
                    sortData;

                // TODO: check if data is empty
                data = data || {};
                data.rows = data.rows || [];

                try {
                    // if dom object already exists empty it and reuse it
                    if (waterfallDomObject) {
                        waterfall = waterfallDomObject;
                        waterfall.set("innerHTML", "");
                    } else {
                        waterfall = Y.Node.create("<div/>");
                    }
                    waterfall.addClass('waterfall');

                    // convert all times to ms
                    normalizeTimes = function (rows) {
                        Y.each(rows, function (row) {
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

                    (function uniqueIds(rows) {
                        var idHeader = data.headers[0],
                            ids = {};
                        if (!Y.Lang.isArray(rows)) {
                            return;
                        }
                        Y.Array.each(rows, function (row) {
                            var id = row[idHeader];
                            ids[id] = ids[id] === undefined ? 0 : 1;
                        });
                        Y.Array.each(rows, function (row) {
                            var id = row[idHeader];
                            if (ids[id]) {
                                row[idHeader] = id + ' (' + ids[id] + ')';
                                ids[id]++;
                            }
                            uniqueIds(row.details);
                        });
                    }(data.rows));

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
                                    // TODO: temp fix to css relative issue in shaker
                                    //toggleButton = Y.Node.create("<div class='plus toggle no-select' style='background:url(/static/Waterfall/assets/images/plus.png) no-repeat'>&nbsp;</div>");
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
                                                    //detailsRow.details.hide();
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

                        // TODO: i dont think this is needed any more
                        timeSlice.setStyle("left", ((100 * (row.startTime - startTime) / (endTime - startTime)) + "%"));
                        timeSliceDurationText.append(msTimeToString(timeSliceDuration, 3));

                        timeSlice.append(timeSliceTr);

                        td.append(timeSlice);

                        // set summary and ruler events
                        td.on("mousedown", function (event) {
                            waterfallRuler.start(event.pageX, event.pageY);
                            waterfallSummary.hide();
                        });
                        td.on("mousemove", function (event) {
                            if (waterfallRuler.isEnabled()) {
                                waterfallRuler.update(event.pageX, event.pageY, td.get("offsetWidth") - paddingRight, endTime - startTime);
                            } else {
                                waterfallSummary.showSummary(rowIndex, event.pageX, event.pageY);
                            }
                        });
                        td.on("mouseout", function (event) {
                            waterfallSummary.hide();
                        });
                        Y.Event.defineOutside('mouseout');
                        tbody.on('mouseoveroutside', function () {
                            waterfallRuler.end();
                        });

                        tbody.on("mouseup", function (event) {
                            waterfallRuler.end();
                        });

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

                    waterfallSummary = new WaterfallSummary(summaries, data.events, tbody);
                    waterfallRuler = new WaterfallRuler();
                    waterfallStats = new WaterfallStats(data.stats);

                    waterfall.append(table);
                    waterfall.append(waterfallSummary.get());
                    waterfall.append(waterfallRuler.get());
                    waterfall.append(waterfallStats.get());
                } catch (e) {
                    waterfall.set("innerHTML", "<span class='error'>Error creating waterfall: " + e.message);
                }
                return waterfall;
            };


        this.get = function () {
            return waterfallDomObject;
        };

        this.update = function (callback) {
            callback(waterfallData || {});
            create(waterfallData, waterfallDomObject);
        };

        waterfallDomObject = create(waterfallData);
    };
}, '0.1.0', {
    requires: [
        'node',
        'transition',
        'event-outside',
        'mojito-waterfall-time',
        'mojito-waterfall-popup'
    ]
});
