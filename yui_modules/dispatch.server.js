/*
 * Copyright (c) 2013, Yahoo! Inc. All rights reserved.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

/*jslint anon:true, nomen:true*/
/*global YUI*/

YUI.add('mojito-waterfall-dispatcher', function (Y, NAME) {
    'use strict';

    var libpath = require('path');

    Y.namespace('mojito.Waterfall').Dispatcher = Y.mix({

        init: function (resourceStore, rpcTunnel, waterfall) {
            this.waterfall = waterfall;
            return Y.mojito.Dispatcher.init.apply(this, arguments);
        },

        _createActionContext: function (command, adapter, path) {
            var ac,
                controllerName = Y.mojito.controllers[command.instance.controller],
                controller = Y.mojito.util.heir(controllerName);


            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatchCreateAction', adapter.hook, 'start', command);
            // HookSystem::EndBlock

            // Note that creation of an ActionContext current causes
            // immediate invocation of the dispatch() call.
            try {
                this.waterfall.start(libpath.join(path, 'Create Action Context'), {level: 'mojito'});
                ac = new Y.mojito.Waterfall.ActionContext({
                    command: command,
                    controller: controller,
                    dispatcher: this,         // NOTE passing dispatcher.
                    adapter: adapter,
                    store: this.store
                }, this.waterfall, path);
                this.waterfall.end(libpath.join(path, 'Create Action Context'));

                // Calling controller after action context creation.
                this.waterfall.start(libpath.join(path, 'Controller'), {level: 'mojito'});
                controller[ac.action](ac);
            } catch (e) {
                this.waterfall.end(libpath.join(path, 'Controller'));
                Y.log('Error from dispatch on instance \'' +
                    (command.instance.id || '@' + command.instance.type) +
                    '\':', 'error', NAME);
                Y.log(e.message, 'error', NAME);
                Y.log(e.stack, 'error', NAME);
                adapter.error(e);
            }
            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatchCreateAction', adapter.hook, 'end', command);
            // HookSystem::EndBlock
        },

        dispatch: function (command, adapter) {
            var my = this,
                store = this.store,
                id = command.instance.instanceId = command.instance.instanceId || Y.guid(),
                name = command.instance.base || command.instance.type,
                done = adapter.done,
                path;

            command.instance.waterfall = command.instance.waterfall || {};
            Y.mix(command.instance.waterfall, {Name: name, level: 'mojit'});

            path = command.instance.waterfall.path || '';
            path = libpath.join(path, '/' + id);

            command.instance.waterfall.path = path;

            my.waterfall.start(path, command.instance.waterfall);

            adapter.done = (function (adapterDone) {
                return function (data, meta) {

                    Y.mix(command.instance.waterfall, meta.waterfall, true);

                    my.waterfall.end(libpath.join(path, 'Render'));
                    my.waterfall.end(path);
                    delete meta.waterfall;
                    return adapterDone.apply(adapter, arguments);
                };
            }(adapter.done));

            adapter.error = (function (adapterError) {
                return function () {
                    my.waterfall.end(path);
                    return adapterError.apply(adapter, arguments);
                };
            }(adapter.error));

            // HookSystem::StartBlock
            Y.mojito.hooks.hook('dispatch', adapter.hook, 'start', command);
            // HookSystem::EndBlock
            try {
                store.validateContext(command.context);
            } catch (err) {
                my.waterfall.end(path);
                adapter.error(err);
                return;
            }

            if (command.rpc) {
                my.waterfall.end(path);
                // forcing to dispatch command through RPC tunnel
                this.rpc(command, adapter);
                return;
            }

            my.waterfall.start(libpath.join(path, 'Expand Instance'), {level: 'mojito'});
            store.expandInstance(command.instance, command.context,
                function (err, instance) {

                    my.waterfall.end(libpath.join(path, 'Expand Instance'));

                    // HookSystem::StartBlock
                    Y.mojito.hooks.hook('dispatch', adapter.hook, 'end', command);
                    // HookSystem::EndBlock

                    if (err || !instance || !instance.controller) {

                        adapter.error(new Error('Cannot expand instance [' + (command.instance.base || '@' +
                            command.instance.type) + '], or instance.controller is undefined'));
                        return;
                    }

                    // We replace the given instance with the expanded instance.
                    command.instance = instance;

                    if (!Y.mojito.controllers[instance.controller]) {
                        // the controller was not found, we should halt
                        adapter.error(new Error('Invalid controller name [' +
                            command.instance.controller + '] for mojit [' +
                            command.instance.type + '].'));
                    } else {
                        // dispatching AC
                        my._createActionContext(command, adapter, path);
                    }
                });
        }

    }, Y.mojito.Dispatcher);

}, '0.1.0', {requires: [
    'mojito-util',
    'mojito-hooks',
    'mojito-dispatcher',
    'mojito-waterfall-action-context'
]});
