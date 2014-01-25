# mojito-waterfall [![Build Status](https://secure.travis-ci.org/yahoo/mojito-waterfall.png)](http://travis-ci.org/yahoo/mojito-waterfall)


mojito-waterfall is an npm package for generating performance visualizations of [Mojito](http://developer.yahoo.com/cocktails/mojito/) applications. It includes an API for collecting timing data and a mojit that renders the waterfall. The [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) package uses this package to automatically instrument Mojito applications and present a waterfall visualization below the application.

[![NPM](https://nodei.co/npm/mojito-waterfall.png)](https://nodei.co/npm/mojito-waterfall/)

[![Screenshot](https://raw.github.com/yahoo/mojito-waterfall/master/images/screenshot1.png)](https://raw.github.com/yahoo/mojito-waterfall/master/images/screenshot1.png)

## Usage

The easiest way to use Waterfall is to simply install the [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) package. [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) by default provides a 'waterfall' debug hook which instruments mojit execution without any code necessary. It also allows users to augment the waterfall with their own instrumentation (see [Augmenting the Waterfall](https://github.com/yahoo/mojito-debug#augmenting-the-waterfall)).

Alternatively, the waterfall may be rendered manually using the Waterfall mojit (see [Waterfall Mojit](#waterfall-mojit)), by passing it a Waterfall GUI object. This object can be created manually (see [Waterfall GUI Object](#waterfall-gui-object)) or generated using the Waterfall API (see [Waterfall API](#waterfall-api)).

To use Waterfall without [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-), install using npm:

```
$ npm install mojito-waterfall
```

## Waterfall API

The Waterfall class can be accessed from any nodejs module through `require('mojito-waterfall').Waterfall`. It can also be accessed from any client/sever side YUI module by requiring `mojito-waterfall` and using `Y.mojito.Waterfall`.

<a name="constructor" href="#constructor">**Waterfall**</a> (config) `constructor` Creates a new Waterfall instance.
* **config** `object` `optional` - See [Configuration](#configuration).

**Example**
```
var waterfall = new Waterfall({
        headers: ['Name', 'Type', 'State']
    });
```

<h2/>

<a name="start" href="#start">**waterfall.start**</a> (profile, data) Marks the start of the given profile.
* **profile** `string` The path of the profile which just started (see [Profile Paths](#profile-path)).
* **data** `object` `optional` - See [Profile Data](#profile-data).

**Example**
```
waterfall.start('Main Mojit', {
    Type: 'Mojit'
});
```

<h2/>

<a name="end" href="#end">**waterfall.end**</a> (profile, data) Marks the end of the given profile.
* **profile** `string` The path of the profile which just ended (see [Profile Paths](#profile-path)).
* **data** `object` `optional` - See [Profile Data](#profile-data).
 
**Example**
```
waterfall.end('Main Mojit', {
    Type: 'Mojit',
    State: 'Executed'
});
```

<h2/>

<a name="event" href="#event">**waterfall.event**</a> (event, data) Marks the occurrence of an event.
* **event** `string` The name of the event.
* **data** `object` `optional` - See [Profile Data](#profile-data).

**Example**
```
waterfall.event('Exception', {
    class: 'error'
});
```

<h2/>

<a name="getGui" href="#getGui">**waterfall.getGui**</a> Gets the resulting Waterfall GUI object. Note this should only be called after instrumentation is finished, as calling it will disable further instrumentation.
* **returns** `object` The resulting Waterfall GUI object (see [Waterfall GUI Object](#waterfall-gui-object)).

**Example**
```
var waterfallGui = waterfall.getGui();
```

<h2/>

<a name="configure" href="#configure">**waterfall.configure**</a> (config) Change any configuration given to the [`constructor`](#constructor). Values in this configuration take precedence to the values in the current configuration.
* **config** `object` - See [Configuration](#configuration).

**Example**
```
waterfall.configure({
    headers: ['Name', 'State', 'Type']
});
```

<h2/>

<a name="pause" href="#pause">**waterfall.pause**</a> Pauses instrumentation by disabling instrumentation calls. These calls have no effect until [`resume`](#resume) is called.

**Example**
```
waterfall.pause();
```

<h2/>

<a name="resume" href="#resume">**waterfall.resume**</a> Resumes instrumentation by re-enabling instrumentation calls that were disabled by [`pause`](#pause).

**Example**
```
waterfall.resume();
```

<h2/>

<a name="clear" href="#clear">**waterfall.clear**</a> Clears all instrumentation. Previous instrumentation calls have no effect.

**Example**
```
waterfall.clear();
```

## Configuration

#### Headers
The [`headers`](#headers) configuration option is an array of strings representing the different columns of the Waterfall. These headers appear in their given order in the head of the Waterfall table. When profile data is passed during instrumentation, fields that have a corresponding header are displayed under the corresponding column of the Waterfall table.

**Example**
```
waterfall.configure({
    headers: ['Name', 'Type']
});

waterfall.start('Main Mojit', {
    Type: 'Mojit' // The value 'Mojit' will appear under the column 'Type' for the 'Main Mojit' profile row.
});
```

#### Classes

The [`classes`](#classes) configuration option is an object whose keys represent [`class`](#class) values and values represent profile data that gets merged with other profile data that belong to profiles with the same corresponding class.

**Example**

```
waterfall.configure({
    classes: {
        error: {
            color: 'red'
        }
    }
});
```

#### Event Filters

Event filters appear whenever the waterfall contains events. These filters allow users to toggle the visibility of different groups of events (see the profile data [`group`](#group) option on how to specify which group(s) an event belongs to). The [`eventFilters`](#event-filters) configuration option can be a boolean, defaulting to true, indicating whether the filters should appear. Alternatively, it can be an object that specifies specific filter groups that should be disabled by setting them to false.

**Example**

```
waterfall.configure({
    eventFilters: {
        Client: false // Events beloging to the group 'Client' will initially not be visible.
    }
});
```

[![Events](https://raw.github.com/yahoo/mojito-waterfall/master/images/events.png)](https://raw.github.com/yahoo/mojito-waterfall/master/images/events.png)

#### Stats Filters

Stats are automatically generated for all profile types; this can lead to a large amount of statistical data. In order to display only certain types of stats, use the [`stats`](#stats-filters) configuration option. This option is an object that accepts two kinds of filters: `profileFilter` and `statsFilter`. These filters are boolean expressions that specify which profile should appear based on profile data and stat values.

`profileFilter` is an expression containing fields that may appear in profile data. The example below indicates that only profiles with the name 'Mojito' or of type 'Mojit' should appear.

```
waterfall.configure({
    stats: {
        profileFilter: 'Name === "Mojito" || Type === "Mojit"'
    }
});
```

`statsFilter` is an expression containing fields of stats type 'Calls', 'Total Duration', 'Avg Duration', 'Min Duration', and 'Max Duration'. The example below indicates that profiles with more than 10 calls and an avg duration greater than 3ms should appear. The time units refer to the units of the waterfall (ns on the server-side and ms on the client-side).

```
waterfall.configure({
    stats: {
        statsFilter: 'Calls > 10 && Avg Duration > 3e6'
    }
});
```

## Profile Data

Instrumentation calls ([`start`](#start), [`end`](#end), [`event`](#event)) accept profile data as an optional second argument. This object is primarily used to specify the profile's column value, but can also accept any field that might be useful when specifying a profileFilter (see [Stats Filters](#stats-filters)). Special fields include [`color`](#color), [`class`](#class), and [`group`](#group).

#### Color

The [`color`](#color) option specifies what color the profile/event should be. This value is a string representing a css color value.

#### Class

The [`class`](#class) option specifies what class(es) a profile/event belongs to. This value can be a string, representing a single class, or an array of strings representing multiple classes. If no class is specified, the class is inferred as the profile's name. The class is used to merge pre-defined profile data objects into the profile's data (see [Classes](#classes)). The current profile data takes precedence, and if multiple classes are specified, classes appearing first take precedence over those appearing after. If the class' profile data object itself has classes, they get added to the profile's classes, and corresponding class object also get merged.

#### Group

The [`group`](#group) option is only used to specify which group(s) an event belongs to. This value can be a string, representing a single group, or an array of string, representing multiple groups. The group is used by the [event filters](#event-filters) in order to toggle groups of events. If no group is specified, the group is inferred as the event's name.

## Profile Path

Waterfall can handle all kinds of instrumentation scenarios involving overlapping profiles, profiles with the same name, and profiles within profiles. The resulting waterfall can have profiles with multiple deeply nested children profiles. Profile paths allow users to specify where exactly the profile should appear.

The simplest path is a relative path that just involves the profile name. This results in a profile that belong to closest profile that is still open. In the example below, profile 'b' ends up being a child of profile 'a'.

```
waterfall.start('a');
waterfall.start('b');
waterfall.end('b');
waterfall.end('a');
```

More complex relative paths use '/' to indicate a deeply nested child profile starting from the closest profile that is still open. In the example below, profile 'c' is nested within 'b' which ends up being a child of 'a'.

```
waterfall.start('a');
waterfall.start('b/c');
waterfall.end('b/c');
waterfall.end('a');
```

Finally a path can be absolute by starting with a '/'. This forces the profile to appear at the root regardless of any other open profile. In the example below, profile 'b' does not become a child of 'a'.

```
waterfall.start('a');
waterfall.start('/b');
waterfall.end('/b);
waterfall.end('a');
```

#### Profile Duration

A profile can be subdivided into durations. Durations appear as different colors within the profile and their details can be seen while mousing over the profile. A duration is specified by appending ':' followed by the duration name to the profile path. In the example below, profile 'a' is subdivided into two durations, 'x', and 'y'.

```
waterfall.start('a:x');
waterfall.end('a:x');
waterfall.start('a:y');
waterfall.end('a:y');
```

## Waterfall Mojit

The Waterfall mojit takes a [Waterfall GUI object](#waterfall-gui-object) and renders the waterfall using its binder. Pass the Waterfall GUI object through params > body > waterfall. If a Waterfall instance is used, make sure to pass the object returned by waterfall.getGui. In the example below, the Waterfall mojit is executed using ac.composite.

```
ac.composite.execute({
    waterfall: {
        params:
            body:
                waterfall: waterfall.getGui()
            }
        }
    }
}, function (data, meta) {
    ac.done(data, meta);
})
```

## Waterfall GUI Object

The Waterfall visualization is represented by an object that describes the columns, profile rows, events, and stats. The 'mojito-waterfall-gui' YUI module uses this object to render the visualization. It is most easily created by using [waterfall.getGui](#getGui), but can also be created manually. The object accepts the fields [`units`](#units), [`headers`](#headers), [`rows`](#rows), [`events`](#events), and [`stats`](#stats):

#### Example

```
{
    headers: ['Name', 'Type`],
    units: 'ms',
    rows: [{
        Name: 'Main',
        Type: 'Mojit',
        durations: [{
            startTime: 0,
            duration: 100,
            name: 'Elapsed Time',
            color: 'green'
        }],
        details: [{
            Name: 'Controller',
            durations: [{
                startTime: 10,
                duration: 30,
                name: 'Elapsed Time',
                color: '#1133CC'
            }]
        }]
    }],
    events: [{
        name: 'Render Start',
        time: 85,
        color: 'rgb(220, 30, 40)'
    }],
    stats: [{
        "Name": "dispatch",
        "Calls": 36,
        "Total Duration": "45.97ms",
        "Avg Duration": "1.277ms",
        "Min Duration": "255.7µs (Child)",
        "Max Duration": "23.57ms (Main)",
        "summary": [{
            "Name": "Main",
            "Duration": "23.57ms"
        }]
    }]
}
```

#### Units

All time values in the Waterfall GUI object must be integers, and so specifying a unit is important. The acceptable units are `ps`, `ns`, `us`, `ms`, `s`, `min`, and `h`. By default `ms` is assumed.

#### Headers

The [`headers`](#headers) option is an array of strings representing the columns of the waterfall.

#### Rows

The [`rows`](#rows) option is an array of row objects representing the root rows of the waterfall. Each row object contain the values for the columns specified, and a required array of `durations`.

**Durations**

The `durations` array must have a least one duration object which represents a colored profile time width. Each duration object must have a `startTime`, a `duration` time, and a `name`. It may also have a `color`; if no color is specified, then one is assigned.

**Details**

Each row may have a `details` field, which can be an array of rows, thereby creating a tree of rows whose children become visible whenever the parent row is expanded. `details` can also be an html string which is displayed when the row is expanded.

#### Events

The `events` option is an array of events. Each event is an object that must have a `time` and a `name`. It may also have a `color`; if no color is specified, then one is assigned.

#### Stats

The `stats` options is a array of stats. Each stat is an object representing a row in the stats table. Each object should specify a set of keys that represent the column and whose values represent the row value. It can also have a `summary` field, which renders as a popup table when the mouse hovers over the stat row. This field is an array of summary objects, which, just like the stats object, contain a set of keys/values used to populate the table.
