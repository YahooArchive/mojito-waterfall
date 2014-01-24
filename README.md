# mojito-waterfall [![Build Status](https://secure.travis-ci.org/yahoo/mojito-waterfall.png)](http://travis-ci.org/yahoo/mojito-waterfall)


mojito-waterfall is an npm package for generating performance visualizations of [Mojito](http://developer.yahoo.com/cocktails/mojito/) applications. It includes an API for collecting timing data and a mojit that renders the waterfall. The [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) package uses this package to automatically instrument Mojito applications and present a waterfall visualization below the application.

[![NPM](https://nodei.co/npm/mojito-waterfall.png)](https://nodei.co/npm/mojito-waterfall/)

[![Screenshot](https://raw.github.com/yahoo/mojito-waterfall/master/images/screenshot1.png)](https://raw.github.com/yahoo/mojito-waterfall/master/images/screenshot1.png)

## Usage

The easiest way to use Waterfall is to simply install the [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) package. [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-) by default provides a 'waterfall' debug hook that instruments mojit execution without any code necessary. It also allows you to augment the waterfall with your own instrumentation (see [Augmenting the Waterfall](https://github.com/yahoo/mojito-debug/edit/master/README.md#augmenting-the-waterfall)).

Alternatively, you may render a waterfall yourself using the Waterfall mojit (see [Waterfall Mojit](#waterfall-mojit)), by passing it a Waterfall GUI object. You can either manually create this object (see [Waterfall GUI Object](#waterfall-gui-object) or generate it using the Waterfall API (see [Waterfall API](#waterfall-api)).

If you wish to use Waterfall without [mojito-debug](https://github.com/yahoo/mojito-debug#mojito-debug-), install using npm:

        $ npm install mojito-waterfall
        
## Waterfall API

<a name="constructor" href="#constructor">**Waterfall**</a> (config) `constructor` Creates a new Waterfall instance.
* **config** `object` `optional` - See [Configuration](#configuration).

**Example**
```
var Waterfall = require('mojito-waterfall').Waterfall,
    waterfall = new Waterfall({
        headers: ['Name', 'Type', 'State']
    });
```

<h2/>

<a name="start" href="#start">**waterfall.start**</a> (profile, data) Marks the start of the given profile.
* **profile** `string` The path of the profile which just started - See [Profile Paths](#profile-path)
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

<a name="event" href="#event">**waterfall.event**</a> (event, data)
* **event** `string` The name of the event.
* **data** `object` `optional` - See [Profile Data](#profile-data).

**Example**
```
waterfall.event('Exception', {
    class: 'error'
});
```

<h2/>

<a name="getGui" href="#getGui">**waterfall.getGui**</a> Gets the resulting Waterfall GUI object. Note this should only be called after instrumentation is finished as calling it will disable further instrumentation.
* **returns** `object` The resulting Waterfall GUI object (see [Waterfall GUI Object](#waterfall-gui-object)).

**Example**
```
var waterfallGui = waterfall.getGui();
```

<h2/>

<a name="configure" href="#configure">**waterfall.configure**</a> (config) Change any configuration given to the [`constructor`](#constructor). Values in this configuration take precedence to the values in the current configuration.
* **config** `object` `optional` - See [Configuration](#configuration).

**Example**
```
waterfall.configure({
    headers: ['Name', 'State', 'Type']
});
```

<h2/>

<a name="pause" href="#pause">**waterfall.pause**</a> Pauses instrumentation by disabling instrumentation calls. These calls have no effect until [`resume`](#waterfall.resume) is called.

**Example**
```
waterfall.pause();
```

<h2/>

<a name="resume" href="#resume">**waterfall.resume**</a> Resumes instrumentation by re-enabling isntrumentation calls that were disabled by [`pause`](#waterfall.pause).

**Example**
```
waterfall.resume();
```

<h2/>

<a name="clear" href="#clear">**waterfall.clear**</a> Clears all isntrumentation. Previous instrumentation calls have no effect.

**Example**
```
waterfall.clear();
```

---

### Configuration

#### Headers
The `headers` configuration options is an array of strings representing the different columns of the Waterfall. These headers appear in their given order in the head of the Waterfall table. When profile data is passed during instrumentation, fields that have a corresponding header are displayed under the corresponding column of the Waterfall table.

**Example**
```
waterfall.configure({
    headers: ['Name', 'Type']
});

waterfall.start('Main Mojit', {
    Type: 'Mojit' // The value 'Mojit' will appear under the column 'Type' for the 'Main Mojit' profile row.
});
```

#### Event Filters

Event filters appear whenever the waterfall contains events. These filters allow users to toggle the visibility of different groups of events (see [Profile Data](#profile-data) for how to specify which group(s) an event belongs to). The `eventsFilter` configuration option can be a boolean, defaulting to true, indicating whether the filters should appear. Alternatively, it can be an object that specifies specific filter groups that should be disabled by setting them to false.

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



###Profile Data
