/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*global YUI */

YUI.add('mojito-waterfall-stats-table', function (Y, NAME) {
    'use strict';

    function StatsTable(stats) {
        var fieldset = Y.Node.create("<fieldset/>"),
            legend = Y.Node.create("<legend>Statistics</legend>"),
            table = Y.Node.create("<table cellpadding='0' cellspacing='0'/>").addClass('stats waterfall-table'),
            thead,
            tbody,
            th,
            tr,
            td,
            rows = [],
            popup,
            popupSummary;

        // Create header.
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

        // Create body.
        tbody = Y.Node.create("<tbody/>");
        Y.Object.each(stats, function (stat) {
            if (!Y.Lang.isObject(stat)) {
                return;
            }
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

        legend.on('click', function () {
            table.toggleView();
        });

        fieldset.append(legend);
        fieldset.append(table);

        // Attach popup.
        popup = new Y.mojito.Waterfall.Popup(fieldset, 'table > tbody > tr', function (e, row) {
            var summary = rows[row].summary;
            popup.node.set("innerHTML", "");
            if (!summary || summary.length === 0) {
                return;
            }
            popupSummary = Y.Node.create("<table/>").addClass('stat');
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
            popup.node.append(popupSummary);
        }, null, 'stat');

        return fieldset;
    }

    Y.namespace('mojito.Waterfall').StatsTable = StatsTable;

}, '0.0.1', {
    requires: [
        'node',
        'mojito-waterfall-popup'
    ]
});
